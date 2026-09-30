#!/usr/bin/env bash
#
# Zera o conteúdo do Vulture preservando as contas cadastradas.
#
# Para quê: recomeçar os testes do piloto sem gastar cota de armazenamento e sem fazer
# ninguém criar conta de novo.
#
#   APAGA  vídeo, foto, post, comentário, curtida, palpite, liga, conversa, rasante,
#          live, notificação, denúncia, ranking, títulos — e os ARQUIVOS no Cloudflare R2
#   MANTÉM contas (auth.users + profiles), tokens de push, administradores,
#          configuração do R2, limites de custo e o calendário do Flamengo
#
# Uso:
#   export SUPABASE_SERVICE_ROLE_KEY='...'     # painel → Settings → API → service_role
#   ./scripts/limpar-tudo.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

vermelho() { printf '\033[31m%s\033[0m\n' "$1"; }
amarelo()  { printf '\033[33m%s\033[0m\n' "$1"; }
verde()    { printf '\033[32m%s\033[0m\n' "$1"; }

[ -f .env ] || { vermelho "Erro: .env não encontrado. Rode a partir da raiz do projeto."; exit 1; }
set -a; . ./.env; set +a

URL="${EXPO_PUBLIC_SUPABASE_URL:-}"
ANON="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}"
[ -n "$URL" ] || { vermelho "Erro: EXPO_PUBLIC_SUPABASE_URL não está no .env"; exit 1; }

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  vermelho "Erro: falta a service role key."
  echo
  echo "  Pegue em: ${URL/https:\/\//https://supabase.com/dashboard/project/}"
  echo "            → Settings → API → service_role (secret)"
  echo
  echo "  Depois rode:"
  echo "    export SUPABASE_SERVICE_ROLE_KEY='cole-aqui'"
  echo "    ./scripts/limpar-tudo.sh"
  exit 1
fi

# ---------------------------------------------------------------- antes
echo
amarelo "=== SITUAÇÃO ATUAL ==="
# A coluna é explícita porque nem toda tabela tem "id": palpites usa chave composta
# (usuario_id, partida_id), e em profiles o "select=*" é barrado pelos grants por coluna.
contar() {
  curl -s -D- -o /dev/null -H "apikey: $ANON" -H "Prefer: count=exact" -H "Range: 0-0" \
    "$URL/rest/v1/$1?select=$2" 2>/dev/null | grep -i content-range \
    | sed -E 's|.*/([0-9]+).*|\1|' | tr -d '\r'
}
resumo() {
  printf '  %-14s %s\n' "contas:"   "$(contar profiles id)"
  printf '  %-14s %s\n' "vídeos:"   "$(contar videos id)"
  printf '  %-14s %s\n' "posts:"    "$(contar posts id)"
  printf '  %-14s %s\n' "palpites:" "$(contar palpites usuario_id)"
}
resumo

echo
amarelo "Isto vai APAGAR todo o conteúdo e os arquivos no R2."
verde   "As contas cadastradas serão PRESERVADAS."
echo
read -r -p "Digite APAGAR CONTEUDO para confirmar: " resposta

if [ "$resposta" != "APAGAR CONTEUDO" ]; then
  echo "Cancelado — nada foi alterado."
  exit 0
fi

# ---------------------------------------------------------------- execução
echo
echo "Limpando..."
resposta_api=$(curl -s -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"confirmacao":"APAGAR CONTEUDO"}' \
  "$URL/functions/v1/limpar-tudo")

echo "$resposta_api" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    print(sys.stdin.read()); sys.exit(1)

if d.get("error"):
    print(f"\033[31mFalhou: {d[\"error\"]}\033[0m"); sys.exit(1)

print(f"\n\033[32m✓ Concluído\033[0m")
print(f"  arquivos apagados no R2: {d.get(\"arquivosApagados\", 0)}")
print(f"  linhas apagadas:         {d.get(\"linhasApagadas\", 0)}")
print(f"  contas preservadas:      {d.get(\"contasPreservadas\", 0)}")
tabelas = d.get("tabelas") or []
if tabelas:
    print("\n  por tabela:")
    for t in tabelas:
        print(f"    {t[\"tabela\"]:<24} {t[\"apagadas\"]}")
'

# ---------------------------------------------------------------- depois
echo
amarelo "=== DEPOIS ==="
resumo
echo
echo "O calendário do Flamengo e a configuração do R2 continuam intactos."
echo "O monitor de uso do bucket recomeça a medir no próximo ciclo (04:20)."
