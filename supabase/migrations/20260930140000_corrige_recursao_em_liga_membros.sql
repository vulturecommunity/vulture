-- =====================================================================================
-- CORREÇÃO: recursão infinita na RLS de liga_membros
--
-- A policy de leitura fazia uma subconsulta NA PRÓPRIA liga_membros:
--
--   create policy "liga_membros leitura de membro" on public.liga_membros for select using (
--     exists (select 1 from public.liga_membros meu
--              where meu.liga_id = liga_membros.liga_id and meu.usuario_id = auth.uid())
--   );
--
-- Avaliar essa policy exige consultar liga_membros, o que reativa a MESMA policy —
-- recursão infinita (Postgres erro 42P17). A policy de "ligas" também quebrava em cascata,
-- porque ela consulta liga_membros para saber se o usuário é membro.
--
-- Isso ficou adormecido porque o app só acessa ligas pelas RPCs (criar_liga,
-- entrar_na_liga, minhas_ligas, ranking_da_liga), todas security definer — que ignoram RLS
-- e nunca disparavam o bug. Só apareceu ao consultar a tabela direto via REST.
--
-- Correção: função auxiliar security definer. Como ela roda com o privilégio do dono
-- (que ignora RLS nas próprias tabelas), a consulta interna não reativa a policy — é o
-- padrão recomendado do Postgres para checagem de participação em tabelas com RLS.
-- =====================================================================================

create or replace function public.sou_membro_da_liga(p_liga_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.liga_membros m
     where m.liga_id = p_liga_id and m.usuario_id = auth.uid()
  );
$$;

revoke execute on function public.sou_membro_da_liga(uuid) from public, anon;
grant execute on function public.sou_membro_da_liga(uuid) to authenticated;

drop policy if exists "liga_membros leitura de membro" on public.liga_membros;
create policy "liga_membros leitura de membro" on public.liga_membros for select using (
  public.sou_membro_da_liga(liga_membros.liga_id)
);

drop policy if exists "ligas leitura de membro" on public.ligas;
create policy "ligas leitura de membro" on public.ligas for select using (
  public.sou_membro_da_liga(ligas.id)
);

-- -------------------------------------------------------------------------------------
-- Autoteste: confere que as duas tabelas respondem sem 42P17.
--
-- Rodar a consulta com o mesmo privilégio da migration não provaria nada: quem aplica
-- migration ignora RLS (é dono das tabelas). O teste precisa assumir o papel
-- "authenticated" — o mesmo que qualquer usuário logado tem — para a policy realmente
-- ser avaliada. A recursão é um problema de PLANEJAMENTO da consulta (a policy referencia
-- a própria tabela), não depende de existir linha nenhuma: funciona em banco vazio.
-- -------------------------------------------------------------------------------------

do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid()::text)::text, true);

  perform * from public.ligas limit 1;
  perform * from public.liga_membros limit 1;

  reset role;
  raise notice 'autoteste de recursao em liga_membros: OK (RLS nao entrou em loop)';
exception
  when sqlstate '42P17' then
    reset role;
    raise exception 'a recursao continua: %', sqlerrm;
  when others then
    reset role;
    raise;
end $$;
