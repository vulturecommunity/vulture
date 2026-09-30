-- =====================================================================================
-- Cadastra o bucket público do Cloudflare R2 como origem válida de mídia.
--
-- Sem esta linha, um anexo de post apontando para o R2 seria recusado pela RLS
-- ("violates row-level security") mesmo com o upload tendo funcionado — a validação de
-- midias_do_post_validas() só aceita URLs de origens conhecidas (ver migration
-- 20260930120000_midia_no_r2.sql).
--
-- Precisa ser IDÊNTICA ao R2_PUBLIC_URL configurado nos segredos das Edge Functions e ao
-- EXPO_PUBLIC_MIDIA_URL do app, sem barra no fim.
-- =====================================================================================

insert into public.origens_de_midia (base, descricao)
values ('https://pub-3b0f41fd874d41e4a7003feeeb74bc5d.r2.dev', 'Cloudflare R2 — bucket vulture-midia')
on conflict (base) do nothing;
