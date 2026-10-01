-- =====================================================================================
-- NOTIFICATIONS PARTICIONADA POR MÊS
--
-- O PROBLEMA
--
-- `notifications` é a tabela que mais cresce por usuário ativo: cada curtida, comentário,
-- novo seguidor e live vira linha. A limpeza existe (`limpar_dados_antigos` apaga o que
-- passou de 30 dias), mas DELETE em massa é a pior forma de apagar muita coisa no
-- Postgres: escreve WAL do tamanho do que apaga, deixa tupla morta para o autovacuum
-- recolher e não devolve espaço ao disco sem um VACUUM FULL, que trava a tabela.
--
-- Com partição por mês, a retenção vira `drop table` da partição vencida: instantâneo,
-- sem WAL proporcional e devolvendo o arquivo inteiro ao sistema.
--
-- POR QUE `contador_pendente` NÃO ENTRA AQUI
--
-- Ela aparecia junto nesta tarefa, e particioná-la seria errado. Não é um log que cresce:
-- é uma FILA que `consolidar_contadores` esvazia a cada minuto (`delete ... where id <=
-- teto`). O problema de uma fila de alto giro não é volume acumulado, é bloat — tupla
-- morta acumulando mais rápido do que o autovacuum padrão recolhe. Partição não resolve
-- bloat; autovacuum mais agressivo resolve, e é o que está no fim deste arquivo.
--
-- A CHAVE PRIMÁRIA MUDA
--
-- Numa tabela particionada, a PK precisa conter a chave de partição: `(id, criado_em)` em
-- vez de `(id)`. Conferido antes de escrever isto: o app filtra notificação por `para_id`
-- e por `tipo`, nunca por `id` isolado (ver `listNotificacoes` e
-- `marcarNotificacoesComoLidas`), então nada no cliente quebra.
-- =====================================================================================

do $$
declare
  ja_particionada boolean;
  inicio date := date_trunc('month', now() - interval '1 month')::date;
  fim    date;
  mes    date;
  copiadas bigint;
begin
  select c.relkind = 'p' into ja_particionada
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'notifications';

  if coalesce(ja_particionada, false) then
    raise notice 'notifications ja e particionada: nada a fazer';
    return;
  end if;

  -- 1. a nova tabela, com a mesma forma da antiga
  execute $ddl$
    create table public.notifications_nova (
      like public.notifications including defaults including constraints
    ) partition by range (criado_em)
  $ddl$;

  execute 'alter table public.notifications_nova add primary key (id, criado_em)';

  -- 2. partições: mês passado, mês atual e os dois seguintes. O cron cuida do resto.
  for i in 0..3 loop
    mes := (inicio + (i || ' month')::interval)::date;
    fim := (mes + interval '1 month')::date;
    execute format(
      'create table if not exists public.%I partition of public.notifications_nova
         for values from (%L) to (%L)',
      'notifications_' || to_char(mes, 'YYYY_MM'), mes, fim
    );
  end loop;

  -- 3. tudo que não couber nas partições acima (histórico antigo, ou futuro distante)
  execute 'create table if not exists public.notifications_antigas
             partition of public.notifications_nova default';

  -- 4. os dados
  execute 'insert into public.notifications_nova select * from public.notifications';
  get diagnostics copiadas = row_count;

  execute 'drop table public.notifications cascade';
  execute 'alter table public.notifications_nova rename to notifications';

  -- 5. AS CHAVES ESTRANGEIRAS, UMA A UMA.
  --
  -- `like ... including constraints` NÃO copia foreign key — só CHECK. Isso é silencioso
  -- e grave: sem a FK de `para_id`, apagar um perfil deixa as notificações dele para trás,
  -- e a exclusão de conta passa a mentir (o perfil some, o rastro fica). Encontrado
  -- testando o cascade de verdade contra um Postgres real; o autoteste no fim deste
  -- arquivo existe para que não volte a acontecer.
  execute 'alter table public.notifications
             add constraint notifications_para_id_fkey
             foreign key (para_id) references public.profiles (id) on delete cascade';
  execute 'alter table public.notifications
             add constraint notifications_de_id_fkey
             foreign key (de_id) references public.profiles (id) on delete cascade';
  execute 'alter table public.notifications
             add constraint notifications_video_id_fkey
             foreign key (video_id) references public.videos (id) on delete cascade';
  execute 'alter table public.notifications
             add constraint notifications_live_id_fkey
             foreign key (live_id) references public.live_streams (id) on delete cascade';

  -- post_id entrou junto com a Arquibancada; nem todo banco tem
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'notifications' and column_name = 'post_id'
  ) then
    execute 'alter table public.notifications
               add constraint notifications_post_id_fkey
               foreign key (post_id) references public.posts (id) on delete cascade';
  end if;

  raise notice 'notifications particionada: % linhas migradas', copiadas;
end $$;

-- -------------------------------------------------------------------------------------
-- Índices, RLS e permissões — recriados porque `like` não os copia
-- -------------------------------------------------------------------------------------

create index if not exists notifications_para_idx
  on public.notifications (para_id, criado_em desc);
create index if not exists notifications_nao_lidas_idx
  on public.notifications (para_id, lida) where lida = false;

alter table public.notifications enable row level security;

drop policy if exists "notifications leitura propria" on public.notifications;
create policy "notifications leitura propria" on public.notifications
  for select using (auth.uid() = para_id);

drop policy if exists "notifications atualizar propria" on public.notifications;
create policy "notifications atualizar propria" on public.notifications
  for update using (auth.uid() = para_id);

grant select, update on public.notifications to authenticated;

-- -------------------------------------------------------------------------------------
-- Partições futuras: criadas com antecedência, não na hora
--
-- Uma linha que chega sem partição correspondente cairia na `default`, que é exatamente o
-- que a partição default existe para evitar — ela é rede de segurança, não destino. Por
-- isso o cron cria com dois meses de folga.
-- -------------------------------------------------------------------------------------

create or replace function public.garantir_particoes_de_notificacoes(p_meses integer default 2)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  mes date;
  fim date;
  nome text;
  criadas integer := 0;
begin
  for i in 0..greatest(1, p_meses) loop
    mes := (date_trunc('month', now()) + (i || ' month')::interval)::date;
    fim := (mes + interval '1 month')::date;
    nome := 'notifications_' || to_char(mes, 'YYYY_MM');

    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = nome
    ) then
      execute format(
        'create table public.%I partition of public.notifications for values from (%L) to (%L)',
        nome, mes, fim
      );
      criadas := criadas + 1;
    end if;
  end loop;
  return criadas;
end;
$$;

/**
 * Retenção: solta a partição inteira em vez de apagar linha a linha.
 *
 * Mantém `p_meses` meses de histórico. A partição default nunca é solta — ela pode conter
 * linha recente que escapou, e perder notificação do mês é pior que guardar demais.
 */
create or replace function public.soltar_particoes_vencidas(p_meses integer default 3)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  corte date := (date_trunc('month', now()) - (p_meses || ' month')::interval)::date;
  parte record;
  soltas integer := 0;
begin
  for parte in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname ~ '^notifications_\d{4}_\d{2}$'
  loop
    if to_date(right(parte.relname, 7), 'YYYY_MM') < corte then
      execute format('drop table public.%I', parte.relname);
      soltas := soltas + 1;
    end if;
  end loop;
  return soltas;
end;
$$;

revoke execute on function public.garantir_particoes_de_notificacoes(integer)
  from public, anon, authenticated;
revoke execute on function public.soltar_particoes_vencidas(integer)
  from public, anon, authenticated;

-- -------------------------------------------------------------------------------------
-- contador_pendente: autovacuum agressivo, que é o remédio certo para fila de alto giro
--
-- Os padrões do Postgres (20% da tabela morta antes de limpar) foram feitos para tabelas
-- que crescem, não para uma que é esvaziada a cada minuto: com 500 linhas vivas, 20% é
-- 100 tuplas mortas — mas a fila gera milhares por hora, e entre uma passada e outra o
-- arquivo incha sem a contagem de linhas mudar.
-- -------------------------------------------------------------------------------------

alter table public.contador_pendente set (
  autovacuum_vacuum_scale_factor = 0.0,
  autovacuum_vacuum_threshold = 200,
  autovacuum_vacuum_cost_delay = 0
);

comment on table public.contador_pendente is
  'Fila de alto giro: consumida e apagada por consolidar_contadores a cada minuto. '
  'NÃO particionar — o problema dela é bloat, não volume. Daí o autovacuum agressivo.';

-- -------------------------------------------------------------------------------------
-- Cron
-- -------------------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('particoes_de_notificacoes')
      where exists (select 1 from cron.job where jobname = 'particoes_de_notificacoes');
    -- dia 25, com folga de sobra antes da virada do mês
    perform cron.schedule(
      'particoes_de_notificacoes',
      '30 4 25 * *',
      $cron$select public.garantir_particoes_de_notificacoes(2)$cron$
    );

    perform cron.unschedule('solta_particoes_vencidas')
      where exists (select 1 from cron.job where jobname = 'solta_particoes_vencidas');
    perform cron.schedule(
      'solta_particoes_vencidas',
      '45 4 2 * *',
      $cron$select public.soltar_particoes_vencidas(3)$cron$
    );
  else
    raise notice 'pg_cron ausente: agende garantir_particoes_de_notificacoes manualmente';
  end if;
end $$;

-- -------------------------------------------------------------------------------------
-- Autoteste: a linha cai na partição certa? o cascade sobrevive? a retenção solta o mês?
--
-- O teste de cascade não é zelo: `like ... including constraints` deixou a tabela sem
-- NENHUMA foreign key na primeira versão desta migração, e o sintoma era invisível —
-- apagar um perfil funcionava, só deixava as notificações órfãs.
-- -------------------------------------------------------------------------------------

do $$
declare
  alguem uuid;
  parte_atual text := 'notifications_' || to_char(now(), 'YYYY_MM');
  antes integer;
  soltas integer;
  fks integer;
  cobaia uuid := '00000000-0000-4000-8000-00000000f1fa';
  sobraram integer;
begin
  select id into alguem from public.profiles order by criado_em limit 1;
  if alguem is null then
    raise notice 'autoteste da particao: pulado (precisa de 1 perfil)';
    return;
  end if;

  -- as FKs precisam existir: sem elas a exclusão de conta mente
  select count(*) into fks
    from pg_constraint
   where conrelid = 'public.notifications'::regclass and contype = 'f';
  if fks < 4 then
    raise exception
      'notifications ficou com % foreign keys; esperado pelo menos 4 (para_id, de_id, video_id, live_id)',
      fks;
  end if;

  begin
    insert into public.notifications (para_id, tipo, texto, criado_em)
    values (alguem, 'sistema', 'autoteste de particao', now());

    -- a linha precisa estar NA partição do mês, não na default
    execute format(
      'select count(*) from public.%I where texto = %L', parte_atual, 'autoteste de particao'
    ) into antes;
    if antes < 1 then
      raise exception 'a notificacao de hoje deveria ter caido em %, caiu na default', parte_atual;
    end if;

    -- e precisa ser visível pela tabela-mãe, que é como o app lê
    select count(*) into antes
      from public.notifications where texto = 'autoteste de particao';
    if antes < 1 then
      raise exception 'a notificacao nao aparece na tabela particionada';
    end if;

    -- O CASCADE DE VERDADE: apagar o perfil precisa levar a notificação junto, através
    -- da partição. É o que a exclusão de conta promete ao titular.
    insert into auth.users (id, email) values (cobaia, 'cobaia@autoteste.local')
    on conflict (id) do nothing;
    insert into public.profiles (id, apelido, nome)
    values (cobaia, 'cobaia_part', 'Cobaia')
    on conflict (id) do nothing;

    insert into public.notifications (para_id, tipo, texto, criado_em)
    values (cobaia, 'sistema', 'some com o perfil', now());

    delete from auth.users where id = cobaia;

    select count(*) into sobraram
      from public.notifications where para_id = cobaia;
    if sobraram > 0 then
      raise exception
        'apagar o perfil deixou % notificacao(oes) orfas: a FK de para_id nao esta valendo na tabela particionada',
        sobraram;
    end if;

    -- uma partição velha é solta pela retenção
    execute format(
      'create table if not exists public.%I partition of public.notifications
         for values from (%L) to (%L)',
      'notifications_2020_01', '2020-01-01'::date, '2020-02-01'::date
    );
    soltas := public.soltar_particoes_vencidas(3);
    if soltas < 1 then
      raise exception 'a particao de 2020 deveria ter sido solta';
    end if;
    if exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = 'notifications_2020_01'
    ) then
      raise exception 'a particao de 2020 continua existindo';
    end if;

    -- a do mês atual NÃO pode ter sido solta junto
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = parte_atual
    ) then
      raise exception 'a retencao soltou a particao do mes atual';
    end if;

    raise exception using errcode = '40001', message = 'AUTOTESTE_OK';
  exception
    when sqlstate '40001' then
      if sqlerrm <> 'AUTOTESTE_OK' then raise; end if;
      raise notice 'autoteste da particao: OK (dados de teste desfeitos)';
  end;
end $$;
