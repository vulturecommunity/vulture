-- =====================================================================================
-- FILA DE PUSH — fan-out sem estourar a Edge Function
--
-- A função notificar-live inseria uma notificação por seguidor e disparava os pushes em
-- lotes sequenciais de 100 DENTRO da requisição. Um perfil com 200 mil seguidores viraria
-- 200 mil inserts + 2.000 chamadas HTTP em série: timeout garantido, e o anfitrião
-- esperando a live começar.
--
-- Agora o fan-out é feito no Postgres (dois INSERT ... SELECT, rápidos mesmo com centenas
-- de milhares de linhas) e o envio fica numa fila que um worker consome em paralelo.
-- A Edge Function só enfileira e responde na hora.
-- =====================================================================================

create table if not exists public.push_pendente (
  id         bigserial primary key,
  token      text not null,
  titulo     text not null,
  corpo      text not null default '',
  dados      jsonb not null default '{}'::jsonb,
  canal      text not null default 'default',
  ttl        integer not null default 3600,
  criado_em  timestamptz not null default now(),
  tentativas smallint not null default 0,
  enviado_em timestamptz,
  erro       text
);

-- o worker pega sempre o mais antigo ainda não enviado
create index if not exists push_pendente_fila_idx
  on public.push_pendente (criado_em) where enviado_em is null;

alter table public.push_pendente enable row level security;
revoke all on public.push_pendente from anon, authenticated;

/**
 * Enfileira um push para todos os aparelhos de uma lista de usuários.
 * Um INSERT ... SELECT: 200 mil destinatários custam uma varredura de índice, não 2 mil
 * requisições HTTP.
 */
create or replace function public.enfileirar_push(
  p_usuarios uuid[],
  p_titulo   text,
  p_corpo    text,
  p_dados    jsonb default '{}'::jsonb,
  p_canal    text default 'default',
  p_ttl      integer default 3600
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  total integer;
begin
  insert into public.push_pendente (token, titulo, corpo, dados, canal, ttl)
  select t.token, p_titulo, p_corpo, p_dados, p_canal, p_ttl
    from public.push_tokens t
   where t.usuario_id = any (p_usuarios);
  get diagnostics total = row_count;
  return total;
end;
$$;

-- -------------------------------------------------------------------------------------
-- FAN-OUT DA LIVE
-- -------------------------------------------------------------------------------------

/**
 * Avisa os seguidores que alguém entrou ao vivo: notificação em tela + push enfileirado.
 * Idempotente — chamar duas vezes para a mesma live não duplica nada.
 */
create or replace function public.notificar_live(p_live_id uuid)
returns table (notificados integer, pushes integer)
language plpgsql
security definer set search_path = public
as $$
declare
  eu uuid := auth.uid();
  live record;
  apelido text;
  qtd_notificados integer := 0;
  qtd_pushes integer := 0;
begin
  if eu is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  select l.id, l.titulo, l.ativa, l.anfitriao_id into live
    from public.live_streams l where l.id = p_live_id;
  if not found then
    raise exception 'Live não encontrada.' using errcode = 'P0002';
  end if;
  if live.anfitriao_id <> eu then
    raise exception 'Só o anfitrião pode avisar.' using errcode = '42501';
  end if;
  if not live.ativa then
    return query select 0, 0;
    return;
  end if;
  -- já avisou antes
  if exists (
    select 1 from public.notifications where live_id = live.id and tipo = 'live' limit 1
  ) then
    return query select 0, 0;
    return;
  end if;

  select p.apelido into apelido from public.profiles p where p.id = eu;

  insert into public.notifications (para_id, tipo, de_id, live_id, texto)
  select f.seguidor_id, 'live', eu, live.id, 'está ao vivo: ' || live.titulo
    from public.follows f
   where f.seguido_id = eu
     and not exists (
       select 1 from public.blocks b
        where (b.usuario_id = f.seguidor_id and b.bloqueado_id = eu)
           or (b.usuario_id = eu and b.bloqueado_id = f.seguidor_id)
     );
  get diagnostics qtd_notificados = row_count;

  insert into public.push_pendente (token, titulo, corpo, dados, canal, ttl)
  select t.token,
         '🔴 @' || coalesce(apelido, 'alguém') || ' está ao vivo',
         coalesce(nullif(live.titulo, ''), 'Toque para assistir') || ' · Toque para assistir',
         jsonb_build_object('tipo', 'live', 'liveId', live.id::text,
                            'url', 'vulture://live/' || live.id::text),
         'lives',
         3600                                   -- live é efêmera: não vale entregar depois
    from public.follows f
    join public.push_tokens t on t.usuario_id = f.seguidor_id
   where f.seguido_id = eu;
  get diagnostics qtd_pushes = row_count;

  return query select qtd_notificados, qtd_pushes;
end;
$$;

-- -------------------------------------------------------------------------------------
-- LEMBRETE DE PALPITE  (o push que mais converte)
--
-- "Fla x Vasco em 2 h. 87.412 palpites já foram dados. Cadê o seu?" — mandado uma vez por
-- jogo, para quem ainda não palpitou. O gancho é o número social, não o lembrete.
-- -------------------------------------------------------------------------------------

alter table public.partidas add column if not exists lembrete_em timestamptz;

create or replace function public.lembrar_palpites(p_antecedencia interval default '3 hours')
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  jogo record;
  total integer := 0;
  quantos integer;
begin
  for jogo in
    select p.id, p.sigla_mandante, p.sigla_visitante, p.data_hora,
           coalesce(r.total, 0) as palpites
      from public.partidas p
      left join public.palpites_resumo r on r.partida_id = p.id
     where p.status = 'agendada'
       and p.lembrete_em is null
       and p.data_hora between now() and now() + p_antecedencia
  loop
    insert into public.push_pendente (token, titulo, corpo, dados, canal, ttl)
    select t.token,
           jogo.sigla_mandante || ' x ' || jogo.sigla_visitante || ' está chegando',
           case when jogo.palpites > 100
                then to_char(jogo.palpites, 'FM999G999G999') ||
                     ' torcedores já palpitaram. Cadê o seu?'
                else 'Dê seu palpite antes da bola rolar.' end,
           jsonb_build_object('tipo', 'palpite', 'partidaId', jogo.id,
                              'url', 'vulture://arquibancada?aba=jogos'),
           'palpites',
           extract(epoch from (jogo.data_hora - now()))::integer
      from public.push_tokens t
      join public.profiles pr on pr.id = t.usuario_id and not pr.anonimo
     where not exists (
       select 1 from public.palpites pa
        where pa.usuario_id = t.usuario_id and pa.partida_id = jogo.id
     );
    get diagnostics quantos = row_count;
    total := total + quantos;
    update public.partidas set lembrete_em = now() where id = jogo.id;
  end loop;
  return total;
end;
$$;

-- -------------------------------------------------------------------------------------
-- RESULTADO DO PALPITE  (o push do momento de euforia)
--
-- Logo depois da apuração: "Você CRAVOU! +10 pts. Subiu 1.204 posições." Chega no pico
-- emocional e leva direto para o ranking.
-- -------------------------------------------------------------------------------------

create or replace function public.avisar_resultado_dos_palpites(p_partida_id text)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  jogo record;
  per text;
  total integer;
begin
  select id, sigla_mandante, sigla_visitante, gols_mandante, gols_visitante, data_hora
    into jogo from public.partidas where id = p_partida_id;
  if not found then return 0; end if;
  per := public.periodo_mensal(jogo.data_hora);

  insert into public.push_pendente (token, titulo, corpo, dados, canal, ttl)
  select t.token,
         case pa.resultado
           when 'cravou'   then '🎯 Você CRAVOU o placar!'
           when 'saldo'    then '👏 Quase lá: você acertou o saldo'
           when 'vencedor' then '✅ Você acertou o resultado'
           else 'Não foi dessa vez'
         end,
         jogo.sigla_mandante || ' ' || jogo.gols_mandante || ' x ' ||
         jogo.gols_visitante || ' ' || jogo.sigla_visitante ||
         ' · +' || pa.pontos || ' pts · você está em ' || rk.posicao || 'º no mês',
         jsonb_build_object('tipo', 'ranking', 'periodo', per,
                            'url', 'vulture://arquibancada?aba=ranking'),
         'palpites',
         21600
    from public.palpites pa
    join public.push_tokens t on t.usuario_id = pa.usuario_id
    join public.ranking_palpiteiros rk
      on rk.usuario_id = pa.usuario_id and rk.periodo = per
   where pa.partida_id = p_partida_id and pa.pontos is not null;
  get diagnostics total = row_count;
  return total;
end;
$$;

revoke execute on function public.enfileirar_push(uuid[], text, text, jsonb, text, integer)
  from public, anon, authenticated;
revoke execute on function public.lembrar_palpites(interval) from public, anon, authenticated;
revoke execute on function public.avisar_resultado_dos_palpites(text)
  from public, anon, authenticated;
grant execute on function public.notificar_live(uuid) to authenticated;
