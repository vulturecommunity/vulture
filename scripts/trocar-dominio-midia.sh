#!/usr/bin/env bash
#
# Troca a base pública da mídia (ex.: pub-xxxx.r2.dev → midia.seudominio.com).
#
# POR QUE ESTE SCRIPT EXISTE
#
# O `pub-*.r2.dev` tem limite de taxa e a própria Cloudflare não o recomenda para
# produção. O problema é que ele não falha com 3 usuários — falha no dia em que algo
# viralizar, que é o pior dia possível para descobrir.
#
# Trocar é barato (os arquivos não se movem, é o mesmo bucket), mas a troca em si é o
# momento mais perigoso do banco: um prefixo errado quebra TODA a mídia de uma vez, e não
# há desfazer sem backup. Por isso aqui tem três etapas, nesta ordem:
#
#   1. mostra quantas linhas serão afetadas, por tabela;
#   2. exige a frase digitada;
#   3. executa tudo numa transação só e mostra o relatório.
#
# ANTES DE RODAR
#
#   1. Configure o domínio no painel da Cloudflare (R2 → Settings → Custom domain)
#      e confirme que https://seu-dominio/<alguma-chave> abre um arquivo.
#   2. Cadastre a base nova:
#        insert into public.origens_de_midia (base, descricao)
#        values ('https://midia.seudominio.com', 'dominio proprio');
#      (a função recusa a troca sem isso, porque a RLS usa essa tabela)
#   3. Atualize EXPO_PUBLIC_MIDIA_URL no .env e R2_PUBLIC_URL nos segredos das functions.
#
# Uso:
#   export SUPABASE_DB_URL='postgresql://postgres:SENHA@db.PROJETO.supabase.co:5432/postgres'
#   ./scripts/trocar-dominio-midia.sh https://pub-xxxx.r2.dev https://midia.seudominio.com
set -euo pipefail

ANTIGA="${1:-}"
NOVA="${2:-}"

if [ -z "$ANTIGA" ] || [ -z "$NOVA" ]; then
  echo "uso: $0 <base-antiga> <base-nova>" >&2
  echo "ex.:  $0 https://pub-xxxx.r2.dev https://midia.seudominio.com" >&2
  exit 1
fi

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "defina SUPABASE_DB_URL (painel → Settings → Database → Connection string)" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "precisa do psql (postgresql-client)" >&2
  exit 1
fi

# tira a barra final: a tabela origens_de_midia guarda sem
ANTIGA="${ANTIGA%/}"
NOVA="${NOVA%/}"

echo
echo "  de:   $ANTIGA"
echo "  para: $NOVA"
echo
echo "→ o que aponta para a base ANTIGA hoje"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
  -c "select * from public.midias_na_base('$ANTIGA');"

echo "→ o que já aponta para a base NOVA"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
  -c "select * from public.midias_na_base('$NOVA');"

TOTAL=$(psql "$SUPABASE_DB_URL" -tAc \
  "select coalesce(sum(linhas),0) from public.midias_na_base('$ANTIGA');")

if [ "$TOTAL" -eq 0 ]; then
  echo "Nada aponta para $ANTIGA. Nada a fazer."
  exit 0
fi

echo
echo "Serão reescritas $TOTAL linha(s). Os arquivos no bucket NÃO se movem."
echo "Digite  TROCAR DOMINIO  para confirmar (qualquer outra coisa cancela):"
read -r RESPOSTA

if [ "$RESPOSTA" != "TROCAR DOMINIO" ]; then
  echo "cancelado."
  exit 1
fi

echo
echo "→ trocando (transação única)"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction \
  -c "select * from public.trocar_dominio_de_midia('$ANTIGA', '$NOVA', 'TROCAR DOMINIO');"

echo
echo "→ conferindo: o que ainda aponta para a base antiga"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
  -c "select * from public.midias_na_base('$ANTIGA');"

cat <<'FIM'

Pronto. Falta, fora do banco:

  1. EXPO_PUBLIC_MIDIA_URL no .env (e um build novo, porque é variável de build)
  2. npx supabase secrets set R2_PUBLIC_URL=<base nova>
  3. manter a base antiga em origens_de_midia por uns dias — link já compartilhado
     continua chegando por lá até o cache expirar

FIM
