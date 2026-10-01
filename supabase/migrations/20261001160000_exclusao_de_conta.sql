-- =====================================================================================
-- EXCLUSÃO DE CONTA — exigência de loja e da LGPD
--
-- Apple e Google recusam, na revisão, todo app com cadastro que não ofereça exclusão de
-- conta DENTRO do app. A LGPD (art. 18, VI) chega no mesmo lugar por outro caminho.
--
-- O trabalho de apagar fica na Edge Function `excluir-conta`, que precisa da service role
-- para mexer em `auth.users`. Aqui mora só o que o Postgres precisa saber:
--
--   1. uma trilha de auditoria que sobrevive à conta (sem nada que identifique a pessoa);
--   2. a garantia, verificada por autoteste, de que apagar a conta não deixa rastro nas
--      tabelas de conteúdo.
--
-- POR QUE A TRILHA NÃO GUARDA E-MAIL NEM APELIDO
--
-- Guardar quem saiu derrota o motivo de sair. O que precisa sobreviver é "uma conta foi
-- apagada nesta data, a pedido do titular" — o suficiente para responder a uma auditoria
-- sem reter dado pessoal de quem pediu para sumir.
-- =====================================================================================

create table if not exists public.exclusoes_de_conta (
  id         uuid primary key default gen_random_uuid(),
  -- o uuid já não aponta para lugar nenhum depois do delete; fica como protocolo
  usuario_id uuid not null,
  criado_em  timestamptz not null default now()
);

comment on table public.exclusoes_de_conta is
  'Trilha de auditoria da exclusão a pedido do titular (LGPD art. 18, VI). '
  'Sem e-mail e sem apelido de propósito: guardar quem saiu derrota o motivo de sair.';

create index if not exists exclusoes_de_conta_data_idx
  on public.exclusoes_de_conta (criado_em desc);

alter table public.exclusoes_de_conta enable row level security;

-- Ninguém no app lê nem escreve aqui: só a Edge Function, com a service role, que passa
-- por cima de RLS. Sem policy = negado para anon e authenticated.
revoke all on public.exclusoes_de_conta from anon, authenticated;

-- -------------------------------------------------------------------------------------
-- Autoteste: alguma referência a profiles impediria a exclusão?
--
-- A exclusão depende de `profiles.id references auth.users (id) on delete cascade` e de
-- cada tabela que aponta para `profiles` saber o que fazer quando a linha some. Duas
-- regras servem, por motivos diferentes:
--
--   CASCADE  — conteúdo da pessoa (vídeo, post, palpite): some junto, que é o pedido.
--   SET NULL — registro que precisa sobreviver a ela. `conversations.ultima_remetente_id`
--              é assim: a conversa continua para o outro participante, sem dono do último
--              recado. O log de moderação também, senão banir alguém apagaria a decisão.
--
-- O que quebra a exclusão é NO ACTION e RESTRICT: o Postgres recusa o delete e a pessoa
-- fica presa numa conta que pediu para apagar. Só esses dois falham aqui.
-- -------------------------------------------------------------------------------------

do $$
declare
  travadas text;
begin
  select string_agg(format('%s.%s (%s)', tc.table_name, kcu.column_name, rc.delete_rule), ', ')
    into travadas
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name
     and kcu.constraint_schema = tc.constraint_schema
    join information_schema.referential_constraints rc
      on rc.constraint_name = tc.constraint_name
     and rc.constraint_schema = tc.constraint_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
     and ccu.constraint_schema = tc.constraint_schema
   where tc.constraint_type = 'FOREIGN KEY'
     and tc.table_schema = 'public'
     and ccu.table_name = 'profiles'
     and ccu.column_name = 'id'
     and rc.delete_rule in ('NO ACTION', 'RESTRICT');

  if travadas is not null then
    raise exception
      'estas referencias a profiles impediriam a exclusao de conta: %. Use ON DELETE CASCADE (conteudo) ou SET NULL (registro que sobrevive).',
      travadas;
  end if;

  raise notice 'autoteste da exclusao de conta: OK (nada trava o delete de profiles)';
end $$;
