-- =====================================================================================
-- LINHAS APROXIMADAS — para estimar quanto cabe antes do limite, não só o que já ocupa
--
-- `tamanho_das_tabelas()` dizia O QUE pesa hoje. Faltava a pergunta seguinte: crescendo no
-- ritmo normal do app (post, vídeo, palpite), quanto dá pra crescer antes de preocupar?
--
-- `reltuples` é a estimativa que o próprio Postgres mantém (atualizada no autovacuum) —
-- instantânea, sem varrer a tabela. Não é exata, mas para "quantos cabem" a exatidão de
-- um count(*) não compensa o custo em tabela grande.
--
-- Importante no projeto novo: antes do primeiro autovacuum, `reltuples` vem 0 mesmo com
-- linhas de verdade — medido aqui logo após a migration (vídeo com 3 linhas reais
-- aparecia como 0). Não é bug da função; é o Postgres ainda não ter analisado a tabela.
-- Conforme o app é usado, o autovacuum roda sozinho e o número passa a refletir a
-- realidade. Para uma contagem exata agora, `select count(*) from public.<tabela>`.
-- =====================================================================================

drop function if exists public.tamanho_das_tabelas(integer);

create function public.tamanho_das_tabelas(p_limite integer default 15)
returns table (
  tabela text,
  tamanho_legivel text,
  bytes bigint,
  linhas_aprox bigint
)
language sql
stable
security definer set search_path = public
as $$
  select
    relname as tabela,
    pg_size_pretty(pg_total_relation_size(c.oid)) as tamanho_legivel,
    pg_total_relation_size(c.oid) as bytes,
    greatest(c.reltuples, 0)::bigint as linhas_aprox
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
  order by pg_total_relation_size(c.oid) desc
  limit greatest(p_limite, 1);
$$;

revoke execute on function public.tamanho_das_tabelas(integer) from public, anon, authenticated;

do $$
declare qtd integer;
begin
  select count(*) into qtd from public.tamanho_das_tabelas(15);
  if qtd = 0 then
    raise exception 'tamanho_das_tabelas() nao devolveu nenhuma linha';
  end if;
  raise notice 'autoteste: OK (% tabelas, agora com linhas aproximadas)', qtd;
end $$;
