-- =====================================================================================
-- PALPITES — integridade e pontuação
--
-- Dois problemas resolvidos aqui:
--
-- 1. SEGURANÇA. A policy antiga conferia `partida_inicio > now()`, mas essa coluna era
--    preenchida pelo cliente. Qualquer pessoa com a chave anon (que é pública por design)
--    mandava `partida_inicio = '2099-01-01'` e registrava o palpite DEPOIS do apito final,
--    com o placar na mão. Com um ranking valendo, o Top 10 viraria uma lista de trapaça.
--    Agora o horário vem de public.partidas e o app nem escreve mais na tabela: usa a RPC
--    salvar_palpite(), que é security definer e decide tudo no servidor.
--
-- 2. PONTUAÇÃO. Cada palpite passa a guardar quanto valeu. É isso que permite o ranking ser
--    calculado UMA vez por jogo em vez de agregado a cada abertura de tela.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- PARTIDAS: peso do jogo e controle de apuração
-- -------------------------------------------------------------------------------------

-- Clássico e mata-mata valem em dobro. Fica numa coluna (e não numa regra escondida no
-- código) para dar para explicar na tela: "ESTE JOGO VALE EM DOBRO".
alter table public.partidas add column if not exists peso smallint not null default 1
  check (peso between 1 and 3);
-- carimbo da apuração: garante que um jogo nunca pontua duas vezes
alter table public.partidas add column if not exists apurada_em timestamptz;

create or replace function public.peso_da_partida(
  p_competicao text, p_fase text, p_mandante text, p_visitante text
)
returns smallint
language sql
immutable
as $$
  select case
    -- final e semifinal de qualquer competição
    when coalesce(p_fase, '') ~* '(final|semi)' then 2::smallint
    -- clássicos cariocas
    when (p_mandante || ' ' || p_visitante) ~* '(vasco|fluminense|botafogo)'
     and (p_mandante || ' ' || p_visitante) ~* 'flamengo' then 2::smallint
    else 1::smallint
  end;
$$;

update public.partidas
   set peso = public.peso_da_partida(competicao, fase, mandante, visitante)
 where peso = 1;

-- -------------------------------------------------------------------------------------
-- PALPITES: colunas de resultado
-- -------------------------------------------------------------------------------------

alter table public.palpites
  add column if not exists pontos     smallint,
  add column if not exists resultado  text,
  -- soma de |palpite - real| dos dois times; é o critério de desempate contínuo do ranking
  add column if not exists desvio     smallint,
  add column if not exists criado_em  timestamptz not null default now();

alter table public.palpites drop constraint if exists palpites_resultado_check;
alter table public.palpites add constraint palpites_resultado_check
  check (resultado is null or resultado in ('cravou', 'saldo', 'vencedor', 'errou'));

-- A partida precisa existir: sem isso o palpite não tem como ser apurado, e o id vinha
-- solto do cliente. NOT VALID não reprova linhas antigas (nada é apagado), mas vale para
-- toda linha nova. Para validar o histórico depois:
--   alter table public.palpites validate constraint palpites_partida_fk;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'palpites_partida_fk'
  ) then
    alter table public.palpites
      add constraint palpites_partida_fk foreign key (partida_id)
      references public.partidas (id) on delete cascade not valid;
  end if;
end $$;

-- ordem do pódio de cada jogo: "Top 10 do Fla x Vasco" sem varrer a tabela
create index if not exists palpites_podio_idx
  on public.palpites (partida_id, pontos desc, desvio asc)
  where pontos is not null;
-- apuração: encontra rapidamente o que ainda não pontuou
create index if not exists palpites_a_apurar_idx
  on public.palpites (partida_id) where pontos is null;

-- -------------------------------------------------------------------------------------
-- O horário do jogo vem do banco, nunca do aparelho
-- -------------------------------------------------------------------------------------

create or replace function public.tg_palpites()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  inicio timestamptz;
begin
  -- apuração (o palpite em si não mudou): deixa passar sem mexer em nada
  if tg_op = 'UPDATE'
     and (new.gols_mandante, new.gols_visitante) is not distinct from
         (old.gols_mandante, old.gols_visitante) then
    return new;
  end if;

  select p.data_hora into inicio from public.partidas p where p.id = new.partida_id;
  if inicio is null then
    raise exception 'Partida % não está no calendário.', new.partida_id
      using errcode = '23503';
  end if;

  new.partida_inicio := inicio;
  new.atualizado_em  := now();
  -- palpite novo ou trocado ainda não vale pontos
  new.pontos    := null;
  new.resultado := null;
  new.desvio    := null;
  return new;
end;
$$;

drop trigger if exists palpites_horario on public.palpites;
create trigger palpites_horario
  before insert or update on public.palpites
  for each row execute function public.tg_palpites();

-- -------------------------------------------------------------------------------------
-- RLS: o prazo é conferido contra public.partidas
-- -------------------------------------------------------------------------------------

drop policy if exists "palpites inserir antes do jogo" on public.palpites;
create policy "palpites inserir antes do jogo" on public.palpites
  for insert with check (
    auth.uid() = usuario_id
    and exists (
      select 1 from public.partidas p
      where p.id = partida_id and p.status = 'agendada' and p.data_hora > now()
    )
  );

drop policy if exists "palpites trocar antes do jogo" on public.palpites;
create policy "palpites trocar antes do jogo" on public.palpites
  for update using (
    auth.uid() = usuario_id
    and exists (
      select 1 from public.partidas p
      where p.id = partida_id and p.status = 'agendada' and p.data_hora > now()
    )
  )
  with check (auth.uid() = usuario_id);

-- Defesa em profundidade: o app não escreve mais direto na tabela (usa a RPC abaixo), e
-- não tem privilégio para tocar em pontos/resultado/desvio de jeito nenhum.
revoke insert, update, delete on public.palpites from anon, authenticated;
grant select on public.palpites to authenticated;

-- -------------------------------------------------------------------------------------
-- RPC: o único caminho para registrar um palpite
-- -------------------------------------------------------------------------------------

create or replace function public.salvar_palpite(
  p_partida_id text, p_gols_mandante integer, p_gols_visitante integer
)
returns table (
  partida_id text, gols_mandante smallint, gols_visitante smallint, atualizado_em timestamptz
)
language plpgsql
security definer set search_path = public
as $$
declare
  eu uuid := auth.uid();
  jogo record;
begin
  if eu is null then
    raise exception 'Você precisa entrar para palpitar.' using errcode = '28000';
  end if;
  if p_gols_mandante is null or p_gols_visitante is null
     or p_gols_mandante < 0 or p_gols_visitante < 0
     or p_gols_mandante > 20 or p_gols_visitante > 20 then
    raise exception 'O placar vai de 0 a 20 gols.' using errcode = '22023';
  end if;

  select p.id, p.data_hora, p.status into jogo
    from public.partidas p where p.id = p_partida_id;
  if not found then
    raise exception 'Jogo não encontrado no calendário.' using errcode = '23503';
  end if;
  if jogo.status <> 'agendada' or jogo.data_hora <= now() then
    raise exception 'Palpites encerrados: a bola já rolou.' using errcode = 'P0001';
  end if;

  insert into public.palpites as pa
    (usuario_id, partida_id, partida_inicio, gols_mandante, gols_visitante)
  values (eu, p_partida_id, jogo.data_hora, p_gols_mandante, p_gols_visitante)
  on conflict (usuario_id, partida_id) do update
    set gols_mandante = excluded.gols_mandante,
        gols_visitante = excluded.gols_visitante;

  return query
    select pa.partida_id, pa.gols_mandante, pa.gols_visitante, pa.atualizado_em
      from public.palpites pa
     where pa.usuario_id = eu and pa.partida_id = p_partida_id;
end;
$$;

revoke execute on function public.salvar_palpite(text, integer, integer) from public, anon;
grant execute on function public.salvar_palpite(text, integer, integer) to authenticated;
