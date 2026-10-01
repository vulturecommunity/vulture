-- =====================================================================================
-- TAMANHO DAS TABELAS — o que realmente ocupa espaço no banco
--
-- O painel de uso mostra o tamanho total do banco (pg_database_size), mas isso não diz
-- O QUE está ocupando aquele espaço. Essa pergunta apareceu de verdade: "esse 18,6 MB é
-- os vídeos postados?" — e a resposta certa exige abrir o banco tabela por tabela, não
-- generalizar. Vídeo nenhum mora no Postgres; só a URL dele (texto) mora aqui. O arquivo
-- em si está no R2, medido à parte.
--
-- `pg_total_relation_size` inclui a tabela, os índices e o TOAST (onde o Postgres guarda
-- texto longo, tipo a legenda de um post) — é o número que corresponde ao espaço
-- realmente ocupado em disco, não só as linhas.
-- =====================================================================================

create or replace function public.tamanho_das_tabelas(p_limite integer default 15)
returns table (
  tabela text,
  tamanho_legivel text,
  bytes bigint
)
language sql
stable
security definer set search_path = public
as $$
  select
    relname as tabela,
    pg_size_pretty(pg_total_relation_size(c.oid)) as tamanho_legivel,
    pg_total_relation_size(c.oid) as bytes
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r' -- só tabela de verdade, não view nem sequência
  order by pg_total_relation_size(c.oid) desc
  limit greatest(p_limite, 1);
$$;

revoke execute on function public.tamanho_das_tabelas(integer) from public, anon, authenticated;

-- -------------------------------------------------------------------------------------
-- Autoteste
-- -------------------------------------------------------------------------------------

do $$
declare
  qtd integer;
  maior_tabela text;
begin
  select count(*) into qtd from public.tamanho_das_tabelas(15);
  if qtd = 0 then
    raise exception 'tamanho_das_tabelas() nao devolveu nenhuma linha';
  end if;

  select tabela into maior_tabela from public.tamanho_das_tabelas(1);
  if maior_tabela is null then
    raise exception 'a maior tabela veio nula';
  end if;

  raise notice 'autoteste do tamanho das tabelas: OK (% tabelas, maior = %)', qtd, maior_tabela;
end $$;
