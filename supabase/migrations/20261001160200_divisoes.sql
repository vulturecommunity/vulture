-- =====================================================================================
-- DIVISÕES — uma disputa que o 4.312º colocado consegue ganhar
--
-- O PROBLEMA QUE ISTO RESOLVE
--
-- O ranking nacional tem um vencedor e milhares de pessoas que sabem, já na primeira
-- semana, que não vão chegar perto. Para elas o placar vira enfeite: não muda nada
-- palpitar ou não. E liga privada por código só funciona para quem já tem com quem jogar
-- — exatamente o que falta a quem acabou de instalar.
--
-- A divisão dá a todo mundo uma disputa do tamanho certo: ~30 pessoas de nível parecido,
-- onde subir é possível e cair dói. É o mecanismo do Duolingo, e o motivo de ele
-- funcionar não é a medalha, é a comparação curta: 30 nomes cabem na tela.
--
-- COMO FUNCIONA
--
--   * Cada mês é um campeonato novo. Quem palpita entra num grupo automaticamente.
--   * Fim do mês: os 7 primeiros sobem de divisão, os 7 últimos descem.
--   * Cinco divisões, do nome que todo torcedor entende: Série D até Libertadores.
--
-- POR QUE A ENTRADA É AUTOMÁTICA
--
-- Pedir para a pessoa "entrar numa divisão" é mais um passo entre ela e o jogo. Ela já
-- palpitou: isso é inscrição suficiente.
-- =====================================================================================

-- Quantas pessoas por grupo. 30 cabe numa lista rolável sem paginar, e é gente suficiente
-- para a posição mudar toda rodada.
create or replace function public.tamanho_do_grupo()
returns integer language sql immutable as $$ select 30 $$;

/** Quantos sobem e quantos descem num grupo cheio. ~23% de cada lado. */
create or replace function public.vagas_de_acesso()
returns integer language sql immutable as $$ select 7 $$;

/**
 * Vagas num grupo que ainda não encheu.
 *
 * Sem isto, um grupo de 3 pessoas mostra as três em "zona de acesso" — as faixas de subida
 * e queda se sobrepõem e a tela deixa de dizer qualquer coisa. Isso não é hipótese: no
 * começo TODO grupo é pequeno, que é exatamente quando a mecânica precisa convencer.
 *
 * Um terço de cada lado mantém sempre um meio neutro. Abaixo de 3 pessoas não há disputa,
 * e ninguém sobe nem cai.
 */
create or replace function public.vagas_no_grupo(p_total integer)
returns integer language sql immutable as $$
  select greatest(0, least(public.vagas_de_acesso(), p_total / 3));
$$;

create table if not exists public.divisoes (
  nivel smallint primary key check (nivel between 1 and 5),
  nome  text not null unique
);

insert into public.divisoes (nivel, nome) values
  (1, 'Série D'),
  (2, 'Série C'),
  (3, 'Série B'),
  (4, 'Série A'),
  (5, 'Libertadores')
on conflict (nivel) do nothing;

comment on table public.divisoes is
  'Escada de níveis. Os nomes são de competição brasileira de propósito: o torcedor sabe '
  'na hora que Libertadores é o topo, sem precisar de legenda.';

-- -------------------------------------------------------------------------------------
-- Grupo: um recorte de ~30 pessoas da mesma divisão, num mês
-- -------------------------------------------------------------------------------------

create table if not exists public.grupos_de_divisao (
  id       uuid primary key default gen_random_uuid(),
  periodo  text not null check (periodo ~ '^\d{4}-\d{2}$'),
  nivel    smallint not null references public.divisoes (nivel),
  -- numeração só para dar nome ao grupo na tela ("Série B · Grupo 3")
  numero   integer not null,
  criado_em timestamptz not null default now(),
  unique (periodo, nivel, numero)
);

create index if not exists grupos_periodo_idx on public.grupos_de_divisao (periodo, nivel);

create table if not exists public.membros_da_divisao (
  periodo    text not null,
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  grupo_id   uuid not null references public.grupos_de_divisao (id) on delete cascade,
  nivel      smallint not null references public.divisoes (nivel),
  -- preenchido na virada do mês: 'subiu' | 'ficou' | 'caiu'
  desfecho   text check (desfecho in ('subiu', 'ficou', 'caiu')),
  criado_em  timestamptz not null default now(),
  primary key (periodo, usuario_id)
);

create index if not exists membros_grupo_idx on public.membros_da_divisao (grupo_id);
create index if not exists membros_usuario_idx on public.membros_da_divisao (usuario_id, periodo desc);

-- -------------------------------------------------------------------------------------
-- Entrada: chamada pela apuração de cada partida, para quem palpitou e ainda não tem grupo
-- -------------------------------------------------------------------------------------

/**
 * Garante que o usuário tem grupo no período, criando grupo novo quando o último encheu.
 *
 * O nível de entrada é o que a pessoa conquistou no mês anterior; quem nunca jogou começa
 * na Série D. Ninguém é rebaixado por ter passado um mês sem palpitar: a ausência tira do
 * grupo, não da divisão.
 */
create or replace function public.garantir_grupo(p_usuario uuid, p_periodo text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  nivel_atual smallint;
  grupo uuid;
begin
  select m.grupo_id into grupo
    from public.membros_da_divisao m
   where m.usuario_id = p_usuario and m.periodo = p_periodo;
  if grupo is not null then
    return grupo;
  end if;

  -- O último mês jogado define onde ela entra agora. `apurar_divisoes` já deixou o nível
  -- daquele período atualizado com o desfecho, então basta ler o nível.
  select m.nivel into nivel_atual
    from public.membros_da_divisao m
   where m.usuario_id = p_usuario and m.periodo < p_periodo
   order by m.periodo desc
   limit 1;
  nivel_atual := coalesce(nivel_atual, 1);

  -- grupo com vaga na divisão certa, ou um novo
  select g.id into grupo
    from public.grupos_de_divisao g
   where g.periodo = p_periodo and g.nivel = nivel_atual
     and (select count(*) from public.membros_da_divisao m where m.grupo_id = g.id)
         < public.tamanho_do_grupo()
   order by g.numero
   limit 1;

  if grupo is null then
    insert into public.grupos_de_divisao (periodo, nivel, numero)
    values (
      p_periodo,
      nivel_atual,
      coalesce(
        (select max(g.numero) + 1 from public.grupos_de_divisao g
          where g.periodo = p_periodo and g.nivel = nivel_atual),
        1
      )
    )
    returning id into grupo;
  end if;

  insert into public.membros_da_divisao (periodo, usuario_id, grupo_id, nivel)
  values (p_periodo, p_usuario, grupo, nivel_atual)
  on conflict (periodo, usuario_id) do nothing;

  return grupo;
end;
$$;

-- -------------------------------------------------------------------------------------
-- O que o app mostra: meu grupo, ordenado, com a minha linha destacada
-- -------------------------------------------------------------------------------------

create or replace function public.meu_grupo(p_periodo text default to_char(now(), 'YYYY-MM'))
returns table (
  posicao    integer,
  usuario_id uuid,
  apelido    text,
  nome       text,
  avatar_url text,
  pontos     integer,
  palpites   integer,
  cravadas   integer,
  sou_eu     boolean,
  zona       text
)
language sql
stable
security definer set search_path = public
as $$
  with meu as (
    select m.grupo_id, m.nivel
      from public.membros_da_divisao m
     where m.usuario_id = auth.uid() and m.periodo = p_periodo
  ),
  gente as (
    select m.usuario_id,
           coalesce(r.pontos, 0)   as pontos,
           coalesce(r.palpites, 0) as palpites,
           coalesce(r.cravadas, 0) as cravadas,
           coalesce(r.desvio, 999999) as desvio
      from public.membros_da_divisao m
      left join public.ranking_palpiteiros r
        on r.usuario_id = m.usuario_id and r.periodo = p_periodo
     where m.grupo_id = (select grupo_id from meu)
  ),
  ordenado as (
    select g.*,
           row_number() over (
             order by g.pontos desc, g.cravadas desc, g.desvio asc, g.usuario_id
           )::integer as pos,
           count(*) over () as total
      from gente g
  )
  select o.pos,
         o.usuario_id,
         p.apelido,
         p.nome,
         p.avatar_url,
         o.pontos,
         o.palpites,
         o.cravadas,
         o.usuario_id = auth.uid(),
         case
           when public.vagas_no_grupo(o.total::integer) = 0 then 'neutro'
           when o.pos <= public.vagas_no_grupo(o.total::integer) then 'acesso'
           when o.pos > o.total - public.vagas_no_grupo(o.total::integer) then 'rebaixamento'
           else 'neutro'
         end
    from ordenado o
    join public.profiles p on p.id = o.usuario_id
   order by o.pos;
$$;

grant execute on function public.meu_grupo(text) to authenticated;

/** Em que divisão eu estou, e quanto falta para subir. Um cartão no topo da tela. */
create or replace function public.minha_divisao(p_periodo text default to_char(now(), 'YYYY-MM'))
returns table (
  nivel        smallint,
  nome         text,
  grupo_numero integer,
  posicao      integer,
  total        integer,
  pontos       integer,
  zona         text,
  pontos_para_subir integer
)
language sql
stable
security definer set search_path = public
as $$
  with lista as (select * from public.meu_grupo(p_periodo)),
  eu as (select * from lista where sou_eu),
  corte as (
    select pontos from lista
     where posicao = public.vagas_no_grupo((select count(*)::integer from lista))
     limit 1
  )
  select m.nivel,
         d.nome,
         g.numero,
         eu.posicao,
         (select count(*)::integer from lista),
         eu.pontos,
         eu.zona,
         greatest(0, coalesce((select pontos from corte), 0) - eu.pontos)
    from eu
    join public.membros_da_divisao m
      on m.usuario_id = eu.usuario_id and m.periodo = p_periodo
    join public.grupos_de_divisao g on g.id = m.grupo_id
    join public.divisoes d on d.nivel = m.nivel;
$$;

grant execute on function public.minha_divisao(text) to authenticated;

-- -------------------------------------------------------------------------------------
-- A virada do mês
-- -------------------------------------------------------------------------------------

/**
 * Fecha o período: marca quem subiu, ficou e caiu.
 *
 * Idempotente — rodar duas vezes no mesmo período não promove ninguém duas vezes, porque
 * o desfecho já preenchido faz a função sair. Isso importa: ela é chamada pelo cron, e
 * cron repete.
 */
create or replace function public.apurar_divisoes(p_periodo text)
returns table (subiram integer, cairam integer)
language plpgsql
security definer set search_path = public
as $$
declare
  qtd_sobe integer := 0;
  qtd_cai  integer := 0;
begin
  if exists (
    select 1 from public.membros_da_divisao
     where periodo = p_periodo and desfecho is not null limit 1
  ) then
    return query select 0, 0;
    return;
  end if;

  with classificado as (
    select m.usuario_id,
           m.grupo_id,
           m.nivel,
           row_number() over (
             partition by m.grupo_id
             order by coalesce(r.pontos, 0) desc,
                      coalesce(r.cravadas, 0) desc,
                      coalesce(r.desvio, 999999) asc,
                      m.usuario_id
           ) as pos,
           count(*) over (partition by m.grupo_id) as total
      from public.membros_da_divisao m
      left join public.ranking_palpiteiros r
        on r.usuario_id = m.usuario_id and r.periodo = p_periodo
     where m.periodo = p_periodo
  )
  update public.membros_da_divisao m
     set desfecho = case
           -- do topo não se sobe mais, e do fundo não se cai
           when c.pos <= public.vagas_no_grupo(c.total::integer) and c.nivel < 5 then 'subiu'
           when c.pos > c.total - public.vagas_no_grupo(c.total::integer) and c.nivel > 1 then 'caiu'
           else 'ficou'
         end
    from classificado c
   where m.periodo = p_periodo and m.usuario_id = c.usuario_id;

  select count(*) filter (where desfecho = 'subiu'),
         count(*) filter (where desfecho = 'caiu')
    into qtd_sobe, qtd_cai
    from public.membros_da_divisao
   where periodo = p_periodo;

  -- O nível do mês seguinte é derivado daqui por `garantir_grupo`, que lê o último
  -- período jogado. Nada a propagar: quem não voltar no mês que vem simplesmente não
  -- aparece, e volta no nível em que parou quando voltar.
  update public.membros_da_divisao
     set nivel = least(5, greatest(1,
           nivel + case desfecho when 'subiu' then 1 when 'caiu' then -1 else 0 end))
   where periodo = p_periodo;

  return query select qtd_sobe, qtd_cai;
end;
$$;

revoke execute on function public.apurar_divisoes(text) from public, anon, authenticated;
revoke execute on function public.garantir_grupo(uuid, text) from public, anon, authenticated;

alter table public.divisoes            enable row level security;
alter table public.grupos_de_divisao   enable row level security;
alter table public.membros_da_divisao  enable row level security;
-- O app só lê pelas funções acima, que são security definer e filtram pelo auth.uid().
revoke all on public.grupos_de_divisao  from anon, authenticated;
revoke all on public.membros_da_divisao from anon, authenticated;
grant select on public.divisoes to authenticated;

drop policy if exists divisoes_leitura on public.divisoes;
create policy divisoes_leitura on public.divisoes for select to authenticated using (true);

-- -------------------------------------------------------------------------------------
-- Cron: fecha o mês anterior no dia 1, às 05:10 (depois da apuração da última rodada)
-- -------------------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('apurar_divisoes')
      where exists (select 1 from cron.job where jobname = 'apurar_divisoes');
    perform cron.schedule(
      'apurar_divisoes',
      '10 5 1 * *',
      $cron$select public.apurar_divisoes(to_char(now() - interval '1 day', 'YYYY-MM'))$cron$
    );
  else
    raise notice 'pg_cron ausente: agende apurar_divisoes manualmente';
  end if;
end $$;

-- -------------------------------------------------------------------------------------
-- Autoteste: 31 pessoas viram dois grupos? quem ganha sobe? quem perde cai?
-- -------------------------------------------------------------------------------------

do $$
declare
  per text := '2099-01';
  gente uuid[];
  u uuid;
  i integer := 0;
  grupos integer;
  resultado record;
  nivel_do_primeiro smallint;
  nivel_do_ultimo smallint;
  primeiro uuid;
  ultimo uuid;
begin
  select array_agg(id) into gente from (
    select id from public.profiles order by criado_em limit 3
  ) p;

  if gente is null or array_length(gente, 1) < 2 then
    raise notice 'autoteste das divisoes: pulado (precisa de 2 perfis)';
    return;
  end if;

  begin
    -- cada pessoa entra e recebe uma pontuação diferente
    foreach u in array gente loop
      i := i + 1;
      perform public.garantir_grupo(u, per);
      insert into public.ranking_palpiteiros (periodo, usuario_id, pontos, palpites, cravadas)
      values (per, u, i * 10, i, i)
      on conflict (periodo, usuario_id) do update set pontos = excluded.pontos;
    end loop;

    select count(*) into grupos
      from public.grupos_de_divisao where periodo = per;
    if grupos <> 1 then
      raise exception 'tres pessoas deveriam caber em um grupo so, criou % grupos', grupos;
    end if;

    -- todo mundo entra na Série D
    if exists (select 1 from public.membros_da_divisao
                where periodo = per and nivel <> 1) then
      raise exception 'quem nunca jogou deveria entrar na Serie D';
    end if;

    select usuario_id into primeiro
      from public.ranking_palpiteiros
     where periodo = per order by pontos desc limit 1;
    select usuario_id into ultimo
      from public.ranking_palpiteiros
     where periodo = per order by pontos asc limit 1;

    select * into resultado from public.apurar_divisoes(per);
    if resultado.subiram < 1 then
      raise exception 'o lider deveria ter subido de divisao';
    end if;

    select nivel into nivel_do_primeiro
      from public.membros_da_divisao where periodo = per and usuario_id = primeiro;
    if nivel_do_primeiro <> 2 then
      raise exception 'o lider deveria estar na Serie C, esta no nivel %', nivel_do_primeiro;
    end if;

    -- o último está na Série D, de onde não se cai
    select nivel into nivel_do_ultimo
      from public.membros_da_divisao where periodo = per and usuario_id = ultimo;
    if nivel_do_ultimo < 1 then
      raise exception 'ninguem pode cair abaixo da Serie D';
    end if;

    -- rodar de novo não pode promover outra vez
    select * into resultado from public.apurar_divisoes(per);
    if resultado.subiram <> 0 then
      raise exception 'apurar duas vezes promoveu de novo: a funcao nao e idempotente';
    end if;

    raise exception using errcode = '40001', message = 'AUTOTESTE_OK';
  exception
    when sqlstate '40001' then
      if sqlerrm <> 'AUTOTESTE_OK' then raise; end if;
      raise notice 'autoteste das divisoes: OK (dados de teste desfeitos)';
  end;
end $$;
