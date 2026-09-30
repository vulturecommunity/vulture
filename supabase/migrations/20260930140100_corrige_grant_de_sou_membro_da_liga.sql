-- =====================================================================================
-- CORREÇÃO: sou_membro_da_liga() sem EXECUTE para "anon"
--
-- A migration anterior revogou EXECUTE de "anon" por hábito (é o padrão certo para
-- funções sensíveis como apurar_partida, que ninguém do app deve chamar). Mas esta função
-- é diferente: ela é acionada IMPLICITAMENTE toda vez que a RLS de "ligas" ou
-- "liga_membros" é avaliada — inclusive para quem não está logado.
--
-- Sem EXECUTE, um usuário anônimo tomava "permission denied for function" (42501, vira
-- 401 no PostgREST) em vez do resultado esperado: lista vazia, porque auth.uid() é NULL
-- para anon e a função deveria simplesmente devolver false, sem erro nenhum.
-- =====================================================================================

grant execute on function public.sou_membro_da_liga(uuid) to anon;

-- -------------------------------------------------------------------------------------
-- Autoteste: desta vez também como "anon", que foi o papel que pegou o bug.
-- -------------------------------------------------------------------------------------

do $$
declare
  vazio boolean;
begin
  set local role anon;

  perform * from public.ligas limit 1;
  perform * from public.liga_membros limit 1;
  select not exists (select 1 from public.ligas) into vazio;

  reset role;
  raise notice 'autoteste do grant de sou_membro_da_liga: OK (anon consulta sem erro)';
exception
  when others then
    reset role;
    raise;
end $$;
