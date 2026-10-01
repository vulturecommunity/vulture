#!/usr/bin/env bash
#
# Aplica schema + migrations num Postgres descartável e roda os autotestes de verdade.
#
# POR QUE ISTO EXISTE
#
# Os autotestes embutidos nas migrations (`do $$ ... raise exception 'AUTOTESTE_OK'`) só
# provam alguma coisa se rodarem com dados. Contra um banco vazio eles imprimem "pulado" e
# passam — que é a pior falha possível: silenciosa e com cara de sucesso.
#
# Aqui o banco sobe com 3 perfis semeados, então os autotestes exercitam o caminho real.
# Erro de sintaxe, função fora de ordem, policy não idempotente e regra de FK quebrada
# aparecem aqui, em 40 segundos, em vez de aparecerem no `supabase db push`.
#
# NÃO substitui o Supabase: pg_cron e o schema `auth` completo não existem aqui, e as
# migrations que dependem deles são puladas com aviso. Serve para o que é possível
# verificar sozinho.
#
# Uso:  ./scripts/testar-migrations.sh            (tudo)
#       ./scripts/testar-migrations.sh 2026100    (só as que casarem com o prefixo)
set -euo pipefail

CONTAINER=vulture-pg-teste
IMAGEM=docker.io/library/postgres:16-alpine
FILTRO="${1:-}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if command -v podman >/dev/null 2>&1; then MOTOR=podman
elif command -v docker >/dev/null 2>&1; then MOTOR=docker
else echo "precisa de podman ou docker" >&2; exit 1; fi

limpar() { $MOTOR rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap limpar EXIT

echo "→ subindo Postgres descartável ($MOTOR)"
limpar
$MOTOR run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=teste -e POSTGRES_DB=vulture \
  "$IMAGEM" >/dev/null

for _ in $(seq 1 60); do
  $MOTOR exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

psql_f() { $MOTOR exec -i "$CONTAINER" psql -U postgres -d vulture -v ON_ERROR_STOP=1 "$@"; }

echo "→ montando o mínimo do ambiente Supabase"
psql_f <<'SQL' >/dev/null
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='supabase_admin') then create role supabase_admin nologin; end if;
end $$;

create schema if not exists auth;
create schema if not exists storage;

-- só as colunas de auth.users que o schema do projeto realmente lê
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid;
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(current_setting('request.jwt.claims', true)::json->>'role','authenticated');
$$;

create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid, created_at timestamptz default now(), metadata jsonb
);
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(regexp_replace(name, '/[^/]*$', ''), '/');
$$;
create or replace function storage.filename(name text) returns text language sql immutable as $$
  select regexp_replace(name, '^.*/', '');
$$;

create publication supabase_realtime;
grant usage on schema public, auth, storage to anon, authenticated, service_role;

-- O Supabase concede acesso amplo a anon/authenticated e deixa o RLS decidir. Sem isto,
-- autotestes que fazem `set local role authenticated` tomam "permission denied" aqui e
-- passariam lá — um falso positivo que esconderia os erros de verdade.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;

-- `agendar()` mora na migration de pg_cron, que não roda aqui. O stub deixa as migrations
-- seguintes aplicarem; o agendamento em si não é o que este script verifica.
create or replace function public.agendar(p_nome text, p_cron text, p_sql text)
returns void language plpgsql as $stub$
begin
  raise notice 'agendar(%) ignorado: sem pg_cron neste ambiente', p_nome;
end;
$stub$;
SQL

echo "→ schema base"
psql_f < "$RAIZ/supabase/schema.sql" 2>&1 | grep -E "(^|:)\s*ERROR:" || true

psql_f <<'SQL' >/dev/null
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
SQL

echo "→ semeando perfis e um jogo (sem eles, os autotestes se pulam ou acusam falso)"
psql_f <<'SQL' >/dev/null
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111','zico@teste.local'),
  ('22222222-2222-2222-2222-222222222222','pedro@teste.local'),
  ('33333333-3333-3333-3333-333333333333','arrasca@teste.local')
on conflict do nothing;
insert into public.profiles (id, apelido, nome, criado_em) values
  ('11111111-1111-1111-1111-111111111111','zico','Zico', now() - interval '3 day'),
  ('22222222-2222-2222-2222-222222222222','pedro','Pedro', now() - interval '2 day'),
  ('33333333-3333-3333-3333-333333333333','arrasca','Arrasca', now() - interval '1 day')
on conflict (id) do nothing;

-- Sem um jogo no calendário, o autoteste de `limpar_conteudo` não distingue "o calendário
-- foi apagado" de "o calendário nunca existiu", e acusa falso.
insert into public.partidas
  (id, temporada, competicao, mandante, visitante, sigla_mandante, sigla_visitante,
   data_hora, status)
values
  ('teste-1', 2026, 'Brasileirão', 'Flamengo', 'Santos', 'FLA', 'SAN',
   now() + interval '7 day', 'agendada')
on conflict (id) do nothing;
SQL

echo "→ migrations"
falhas=0
pulos=0
oks=0

for arquivo in "$RAIZ"/supabase/migrations/*.sql; do
  nome="$(basename "$arquivo")"
  [ -n "$FILTRO" ] && [[ "$nome" != *"$FILTRO"* ]] && continue

  saida="$(psql_f < "$arquivo" 2>&1 || true)"
  erro="$(echo "$saida" | grep -E "(^|:)\s*ERROR:" | head -1 || true)"
  autoteste="$(echo "$saida" | grep -iE "NOTICE:.*autoteste" | head -1 || true)"

  if [ -n "$erro" ]; then
    # dependências do Supabase que não existem aqui não são falha do SQL do projeto
    if echo "$erro" | grep -qiE "pg_cron|cron\.|extension .* is not available|net\.http"; then
      printf '  ~ %-56s (depende de pg_cron)\n' "$nome"
      pulos=$((pulos + 1))
    else
      printf '  ✗ %-56s\n      %s\n' "$nome" "${erro#*ERROR:  }"
      falhas=$((falhas + 1))
    fi
  else
    marca=""
    if echo "$autoteste" | grep -qi "pulado"; then marca=" (autoteste pulado)"
    elif [ -n "$autoteste" ]; then marca=" ✓ autoteste"
    fi
    printf '  ✓ %-56s%s\n' "$nome" "$marca"
    oks=$((oks + 1))
  fi
done

echo
echo "aplicadas: $oks   falhas: $falhas   dependem de pg_cron: $pulos"
[ "$falhas" -eq 0 ] || exit 1
