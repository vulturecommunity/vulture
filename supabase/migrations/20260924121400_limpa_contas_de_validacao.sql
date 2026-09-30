-- =====================================================================================
-- Remove as contas criadas para validar as RPCs novas contra o banco real
-- (e-mails @vulture.test). O cascade leva junto o perfil, o palpite e a liga de teste.
--
-- Nenhuma conta de pessoa de verdade usa esse domínio; se por acaso alguém cadastrar um
-- e-mail assim no futuro, esta migration já terá rodado e não o atinge.
-- =====================================================================================

delete from auth.users where email like '%@vulture.test';
