-- =====================================================================================
-- RANKING DE PALPITEIROS — pódio do jogo, do mês e da temporada
--
-- A regra que sustenta tudo: o ranking é calculado UMA VEZ POR JOGO, quando o apito final
-- chega da Highlightly. Nunca na leitura. Um `order by sum(pontos)` sobre um milhão de
-- palpiteiros a cada abertura de tela derruba o banco; um `order by posicao limit 20` num
-- índice responde em microssegundos.
--
-- Pontuação (multiplicada pelo peso do jogo — clássico e mata-mata valem em dobro):
--   cravou o placar exato ......... 10
--   acertou o saldo de gols ........ 5
--   acertou só o vencedor .......... 3
--   errou .......................... 0
--
-- Desempate: pontos ↓ · cravadas ↓ · desvio de gols ↑. O desvio é contínuo, então empate
-- no topo é raro mesmo com milhares de pessoas e só 6 jogos no mês.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Conta anônima não entra no ranking
--
-- Um visitante custa zero para criar. Sem esta trava, farmar o pódio é trivial: 50 contas
-- anônimas cobrindo todos os placares plausíveis garantem uma cravada. Quem vira conta de
-- verdade passa a pontuar a partir do jogo seguinte.
-- -------------------------------------------------------------------------------------

alter table public.profiles add column if not exists anonimo boolean not null default false;
grant select (anonimo) on public.profiles to anon, authenticated;

create or replace function public.criar_perfil_se_faltar(uid uuid, email_usuario text, meta jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  apelido_base text;
  apelido_final text;
  tentativa integer := 0;
  eh_anonimo boolean;
begin
  select coalesce(u.is_anonymous, false) into eh_anonimo from auth.users u where u.id = uid;

  if exists (select 1 from public.profiles where id = uid) then
    update public.profiles
       set email = email_usuario, anonimo = coalesce(eh_anonimo, false)
     where id = uid
       and (email is distinct from email_usuario or anonimo is distinct from coalesce(eh_anonimo, false));
    return;
  end if;

  apelido_base := coalesce(meta ->> 'apelido', split_part(coalesce(email_usuario, 'torcedor'), '@', 1));
  apelido_base := lower(regexp_replace(apelido_base, '[^a-z0-9._]', '', 'g'));
  if char_length(apelido_base) < 3 then
    apelido_base := 'torcedor' || floor(random() * 9000 + 1000)::text;
  end if;
  apelido_final := left(apelido_base, 20);
  while exists (select 1 from public.profiles where apelido = apelido_final) loop
    tentativa := tentativa + 1;
    apelido_final := left(apelido_base, 16) || floor(random() * 9000 + 1000)::text;
    exit when tentativa > 20;
  end loop;

  insert into public.profiles (id, apelido, nome, email, anonimo)
  values (uid, apelido_final, coalesce(meta ->> 'nome', apelido_final), email_usuario,
          coalesce(eh_anonimo, false))
  on conflict (id) do nothing;
end;
$$;

-- visitante que cria conta de verdade deixa de ser anônimo
create or replace function public.handle_user_email_updated()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
     set email = new.email, anonimo = coalesce(new.is_anonymous, false)
   where id = new.id;
  return new;
end;
$$;

update public.profiles p
   set anonimo = coalesce(u.is_anonymous, false)
  from auth.users u
 where u.id = p.id and p.anonimo is distinct from coalesce(u.is_anonymous, false);

-- -------------------------------------------------------------------------------------
-- TABELAS
-- -------------------------------------------------------------------------------------

-- Um período é o mês ("2026-09", no fuso de Brasília) ou a temporada ("T2026").
create table if not exists public.ranking_palpiteiros (
  periodo       text not null check (char_length(periodo) between 5 and 10),
  usuario_id    uuid not null references public.profiles (id) on delete cascade,
  pontos        integer not null default 0,
  palpites      integer not null default 0,
  cravadas      integer not null default 0,
  saldos        integer not null default 0,
  vencedores    integer not null default 0,
  -- soma de |palpite - placar|: quanto MENOR, melhor (terceiro critério de desempate)
  desvio        integer not null default 0,
  sequencia     integer not null default 0,
  melhor_seq    integer not null default 0,
  posicao       integer,
  posicao_ant   integer,
  atualizado_em timestamptz not null default now(),
  primary key (periodo, usuario_id)
);

-- a ordem oficial do ranking; serve tanto para o cálculo quanto para o Top N
create index if not exists ranking_ordem_idx
  on public.ranking_palpiteiros (periodo, pontos desc, cravadas desc, desvio asc, usuario_id);
-- leitura do Top N já ordenada pela posição congelada
create index if not exists ranking_posicao_idx
  on public.ranking_palpiteiros (periodo, posicao);

-- Pódio congelado no fim do mês: o prêmio de verdade não é aparecer na lista hoje, é ter
-- "Campeão de setembro" no perfil para sempre.
create table if not exists public.titulos (
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  periodo    text not null,
  posicao    smallint not null check (posicao between 1 and 3),
  pontos     integer not null default 0,
  criado_em  timestamptz not null default now(),
  primary key (usuario_id, periodo)
);
create index if not exists titulos_usuario_idx on public.titulos (usuario_id, periodo desc);

-- Fila de apuração: o trigger em partidas só enfileira (rápido); o trabalho pesado fica
-- com o pg_cron, fora do caminho de quem está usando o app.
create table if not exists public.fila_apuracao (
  partida_id text primary key references public.partidas (id) on delete cascade,
  criado_em  timestamptz not null default now(),
  tentativas smallint not null default 0,
  erro       text
);

-- -------------------------------------------------------------------------------------
-- O período de cada jogo
-- -------------------------------------------------------------------------------------

-- Mês no fuso de Brasília: um jogo de 21h30 do dia 31 pertence ao mês certo.
create or replace function public.periodo_mensal(p_data timestamptz)
returns text language sql immutable as $$
  select to_char(p_data at time zone 'America/Sao_Paulo', 'YYYY-MM');
$$;

create or replace function public.periodo_temporada(p_temporada integer)
returns text language sql immutable as $$
  select 'T' || p_temporada::text;
$$;

-- -------------------------------------------------------------------------------------
-- APURAÇÃO
-- -------------------------------------------------------------------------------------

/**
 * Pontua todos os palpites de um jogo e joga o resultado nos rankings do mês e da
 * temporada. Idempotente: o carimbo partidas.apurada_em impede pontuar duas vezes.
 */
create or replace function public.apurar_partida(p_partida_id text)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  jogo record;
  periodos text[];
  per text;
  afetados integer := 0;
begin
  select id, gols_mandante, gols_visitante, status, peso, data_hora, temporada, apurada_em
    into jogo
    from public.partidas
   where id = p_partida_id
     for update;

  if not found then
    raise exception 'Partida % não existe.', p_partida_id;
  end if;
  if jogo.apurada_em is not null then
    return 0;                                  -- já pontuou
  end if;
  if jogo.status <> 'encerrada' or jogo.gols_mandante is null or jogo.gols_visitante is null then
    return 0;                                  -- ainda não tem placar final
  end if;

  -- 1. pontos de cada palpite, numa varredura só (usa palpites_a_apurar_idx)
  update public.palpites pa
     set resultado = case
           when pa.gols_mandante = jogo.gols_mandante
            and pa.gols_visitante = jogo.gols_visitante                      then 'cravou'
           when (pa.gols_mandante - pa.gols_visitante)
              = (jogo.gols_mandante - jogo.gols_visitante)                   then 'saldo'
           when sign((pa.gols_mandante - pa.gols_visitante)::numeric)
              = sign((jogo.gols_mandante - jogo.gols_visitante)::numeric)    then 'vencedor'
           else 'errou'
         end,
         pontos = jogo.peso * case
           when pa.gols_mandante = jogo.gols_mandante
            and pa.gols_visitante = jogo.gols_visitante                      then 10
           when (pa.gols_mandante - pa.gols_visitante)
              = (jogo.gols_mandante - jogo.gols_visitante)                   then 5
           when sign((pa.gols_mandante - pa.gols_visitante)::numeric)
              = sign((jogo.gols_mandante - jogo.gols_visitante)::numeric)    then 3
           else 0
         end,
         desvio = abs(pa.gols_mandante - jogo.gols_mandante)
                + abs(pa.gols_visitante - jogo.gols_visitante)
   where pa.partida_id = p_partida_id
     and pa.pontos is null;

  get diagnostics afetados = row_count;

  -- 2. acumula no ranking do mês e da temporada (contas anônimas ficam de fora)
  periodos := array[
    public.periodo_mensal(jogo.data_hora),
    public.periodo_temporada(jogo.temporada)
  ];

  foreach per in array periodos loop
    insert into public.ranking_palpiteiros as rk
      (periodo, usuario_id, pontos, palpites, cravadas, saldos, vencedores, desvio,
       sequencia, melhor_seq)
    select
      per,
      pa.usuario_id,
      sum(pa.pontos),
      count(*),
      count(*) filter (where pa.resultado = 'cravou'),
      count(*) filter (where pa.resultado = 'saldo'),
      count(*) filter (where pa.resultado = 'vencedor'),
      sum(pa.desvio),
      case when sum(pa.pontos) > 0 then 1 else 0 end,
      case when sum(pa.pontos) > 0 then 1 else 0 end
      from public.palpites pa
      join public.profiles pr on pr.id = pa.usuario_id and not pr.anonimo
     where pa.partida_id = p_partida_id
       and pa.pontos is not null
     group by pa.usuario_id
    on conflict (periodo, usuario_id) do update
      set pontos     = rk.pontos     + excluded.pontos,
          palpites   = rk.palpites   + excluded.palpites,
          cravadas   = rk.cravadas   + excluded.cravadas,
          saldos     = rk.saldos     + excluded.saldos,
          vencedores = rk.vencedores + excluded.vencedores,
          desvio     = rk.desvio     + excluded.desvio,
          -- sequência de jogos seguidos pontuando (a fila processa em ordem cronológica)
          sequencia  = case when excluded.pontos > 0 then rk.sequencia + 1 else 0 end,
          melhor_seq = greatest(
            rk.melhor_seq,
            case when excluded.pontos > 0 then rk.sequencia + 1 else 0 end
          ),
          atualizado_em = now();

    -- 3. congela a nova ordem. Uma passada por período, uma vez por jogo — é o que torna
    --    a leitura do Top N e do "você está em Xº" um lookup de índice.
    with ordenado as (
      select usuario_id,
             row_number() over (
               order by pontos desc, cravadas desc, desvio asc, usuario_id
             ) as pos
        from public.ranking_palpiteiros
       where periodo = per
    )
    update public.ranking_palpiteiros r
       set posicao_ant = r.posicao,
           posicao     = o.pos
      from ordenado o
     where r.periodo = per and r.usuario_id = o.usuario_id;
  end loop;

  update public.partidas set apurada_em = now() where id = p_partida_id;
  delete from public.fila_apuracao where partida_id = p_partida_id;
  return afetados;
end;
$$;

/**
 * Consome a fila. Chamada pelo pg_cron a cada minuto; processa em ordem cronológica para
 * a sequência de acertos ficar correta.
 */
create or replace function public.processar_apuracoes(p_maximo integer default 5)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  alvo record;
  feitos integer := 0;
begin
  for alvo in
    select f.partida_id
      from public.fila_apuracao f
      join public.partidas p on p.id = f.partida_id
     where f.tentativas < 5
     order by p.data_hora
     limit p_maximo
  loop
    begin
      perform public.apurar_partida(alvo.partida_id);
      feitos := feitos + 1;
    exception when others then
      update public.fila_apuracao
         set tentativas = tentativas + 1, erro = sqlerrm
       where partida_id = alvo.partida_id;
    end;
  end loop;
  return feitos;
end;
$$;

-- Trigger: o apito final só enfileira (barato). Quem pontua é o cron.
create or replace function public.tg_partidas_apuracao()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'encerrada'
     and new.gols_mandante is not null
     and new.gols_visitante is not null
     and new.apurada_em is null then
    insert into public.fila_apuracao (partida_id) values (new.id)
    on conflict (partida_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists partidas_apuracao on public.partidas;
create trigger partidas_apuracao
  after insert or update of status, gols_mandante, gols_visitante on public.partidas
  for each row execute function public.tg_partidas_apuracao();

-- jogos que já terminaram antes desta migration entram na fila
insert into public.fila_apuracao (partida_id)
select id from public.partidas
 where status = 'encerrada' and gols_mandante is not null and gols_visitante is not null
   and apurada_em is null
on conflict (partida_id) do nothing;

-- -------------------------------------------------------------------------------------
-- FECHAMENTO DO MÊS (títulos)
-- -------------------------------------------------------------------------------------

create or replace function public.fechar_periodo(p_periodo text)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  gravados integer;
begin
  insert into public.titulos (usuario_id, periodo, posicao, pontos)
  select usuario_id, p_periodo, posicao::smallint, pontos
    from public.ranking_palpiteiros
   where periodo = p_periodo and posicao between 1 and 3 and pontos > 0
  on conflict (usuario_id, periodo) do update
    set posicao = excluded.posicao, pontos = excluded.pontos;
  get diagnostics gravados = row_count;
  return gravados;
end;
$$;

/** Fecha o mês anterior. Chamada pelo pg_cron todo dia 1º. */
create or replace function public.fechar_mes_anterior()
returns integer
language sql
security definer set search_path = public
as $$
  select public.fechar_periodo(
    public.periodo_mensal((now() at time zone 'America/Sao_Paulo' - interval '1 month')
                          at time zone 'America/Sao_Paulo')
  );
$$;

-- -------------------------------------------------------------------------------------
-- LEITURA (RPCs)
-- -------------------------------------------------------------------------------------

/** Top N do período. Uma leitura de índice — cacheável, muda só depois de cada jogo. */
create or replace function public.top_palpiteiros(p_periodo text, p_limite integer default 20)
returns table (
  posicao integer, usuario_id uuid, apelido text, nome text, avatar_url text,
  pontos integer, palpites integer, cravadas integer, sequencia integer, variacao integer
)
language sql stable security definer set search_path = public as $$
  select r.posicao, r.usuario_id, p.apelido, p.nome, p.avatar_url,
         r.pontos, r.palpites, r.cravadas, r.sequencia,
         coalesce(r.posicao_ant - r.posicao, 0)
    from public.ranking_palpiteiros r
    join public.profiles p on p.id = r.usuario_id
   where r.periodo = p_periodo and r.posicao is not null
   order by r.posicao
   limit least(greatest(p_limite, 1), 100);
$$;

/**
 * A linha do próprio usuário e os vizinhos de posição. É isto que faz o ranking valer para
 * quem está em 4.312º: "faltam 3 pontos para passar o próximo".
 */
create or replace function public.minha_faixa_no_ranking(p_periodo text, p_vizinhos integer default 2)
returns table (
  posicao integer, usuario_id uuid, apelido text, nome text, avatar_url text,
  pontos integer, palpites integer, cravadas integer, sequencia integer, variacao integer,
  sou_eu boolean
)
language sql stable security definer set search_path = public as $$
  with minha as (
    select posicao from public.ranking_palpiteiros
     where periodo = p_periodo and usuario_id = auth.uid()
  )
  select r.posicao, r.usuario_id, p.apelido, p.nome, p.avatar_url,
         r.pontos, r.palpites, r.cravadas, r.sequencia,
         coalesce(r.posicao_ant - r.posicao, 0),
         r.usuario_id = auth.uid()
    from public.ranking_palpiteiros r
    join public.profiles p on p.id = r.usuario_id
   cross join minha m
   where r.periodo = p_periodo
     and r.posicao between m.posicao - least(greatest(p_vizinhos, 0), 10)
                       and m.posicao + least(greatest(p_vizinhos, 0), 10)
   order by r.posicao;
$$;

/** Pódio de um jogo específico — a recompensa que chega a cada 3 dias, não a cada 30. */
create or replace function public.podio_da_partida(p_partida_id text, p_limite integer default 10)
returns table (
  posicao bigint, usuario_id uuid, apelido text, nome text, avatar_url text,
  gols_mandante smallint, gols_visitante smallint, pontos smallint, resultado text
)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by pa.pontos desc, pa.desvio asc, pa.atualizado_em),
         pa.usuario_id, p.apelido, p.nome, p.avatar_url,
         pa.gols_mandante, pa.gols_visitante, pa.pontos, pa.resultado
    from public.palpites pa
    join public.profiles p on p.id = pa.usuario_id and not p.anonimo
   where pa.partida_id = p_partida_id and pa.pontos is not null and pa.pontos > 0
   order by pa.pontos desc, pa.desvio asc, pa.atualizado_em
   limit least(greatest(p_limite, 1), 50);
$$;

/**
 * Meses que já têm jogo apurado, do mais recente para o mais antigo. O nome do mês é
 * formatado no app (`nomeDoMes`): o locale do Postgres não é português.
 */
create or replace function public.periodos_do_ranking(p_limite integer default 12)
returns table (periodo text, jogos bigint, temporada integer)
language sql stable security definer set search_path = public as $$
  select public.periodo_mensal(data_hora) as periodo,
         count(*) as jogos,
         max(temporada) as temporada
    from public.partidas
   where apurada_em is not null
   group by 1
   order by 1 desc
   limit least(greatest(p_limite, 1), 36);
$$;

/** Medalhas do perfil. */
create or replace function public.titulos_do_usuario(p_usuario_id uuid)
returns table (periodo text, posicao smallint, pontos integer)
language sql stable security definer set search_path = public as $$
  select periodo, posicao, pontos from public.titulos
   where usuario_id = p_usuario_id order by periodo desc limit 24;
$$;

-- -------------------------------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------------------------------

alter table public.ranking_palpiteiros enable row level security;
alter table public.titulos             enable row level security;
alter table public.fila_apuracao       enable row level security;

-- ranking e títulos são públicos por natureza; escrita só pelas funções (service definer)
drop policy if exists "ranking leitura publica" on public.ranking_palpiteiros;
create policy "ranking leitura publica" on public.ranking_palpiteiros for select using (true);
drop policy if exists "titulos leitura publica" on public.titulos;
create policy "titulos leitura publica" on public.titulos for select using (true);

revoke insert, update, delete on public.ranking_palpiteiros from anon, authenticated;
revoke insert, update, delete on public.titulos from anon, authenticated;
-- a fila é interna: sem policy, ninguém do app enxerga
revoke all on public.fila_apuracao from anon, authenticated;

revoke execute on function public.apurar_partida(text) from public, anon, authenticated;
revoke execute on function public.processar_apuracoes(integer) from public, anon, authenticated;
revoke execute on function public.fechar_periodo(text) from public, anon, authenticated;
revoke execute on function public.fechar_mes_anterior() from public, anon, authenticated;

grant execute on function public.top_palpiteiros(text, integer) to anon, authenticated;
grant execute on function public.minha_faixa_no_ranking(text, integer) to authenticated;
grant execute on function public.podio_da_partida(text, integer) to anon, authenticated;
grant execute on function public.periodos_do_ranking(integer) to anon, authenticated;
grant execute on function public.titulos_do_usuario(uuid) to anon, authenticated;
