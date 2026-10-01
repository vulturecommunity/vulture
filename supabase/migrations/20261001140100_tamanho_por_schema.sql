-- =====================================================================================
-- TAMANHO POR SCHEMA — fechando a conta do pg_database_size
--
-- `tamanho_das_tabelas()` olha só o schema `public` — as tabelas que o app usa. Mas
-- `pg_database_size()`, que é o número que o painel mostra, soma o banco inteiro: auth,
-- storage, realtime, os crons, as extensões, os catálogos do próprio Postgres. Sem essa
-- visão, "o público não bate com o total" vira mistério em vez de resposta.
-- =====================================================================================

create or replace function public.tamanho_por_schema()
returns table (
  schema text,
  tamanho_legivel text,
  bytes bigint
)
language sql
stable
security definer set search_path = public
as $$
  select
    n.nspname as schema,
    pg_size_pretty(sum(pg_total_relation_size(c.oid))) as tamanho_legivel,
    sum(pg_total_relation_size(c.oid))::bigint as bytes
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'i', 't') -- tabela, índice avulso, TOAST
    and n.nspname not in ('pg_catalog', 'information_schema')
  group by n.nspname
  order by sum(pg_total_relation_size(c.oid)) desc;
$$;

revoke execute on function public.tamanho_por_schema() from public, anon, authenticated;

do $$
declare qtd integer;
begin
  select count(*) into qtd from public.tamanho_por_schema();
  if qtd = 0 then
    raise exception 'tamanho_por_schema() nao devolveu nenhuma linha';
  end if;
  raise notice 'autoteste do tamanho por schema: OK (% schemas)', qtd;
end $$;
