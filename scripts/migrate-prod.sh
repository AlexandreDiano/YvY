#!/usr/bin/env bash
# Aplica as migrations na produção pelo migrate.yml.
#
#   bash scripts/migrate-prod.sh plan    # dry-run; escreve pending=true|false
#   bash scripts/migrate-prod.sh apply   # db push de verdade
#
# Erro do CLI vira anotação (::error::) além do log: anotação de check run é
# lida pela API pública do GitHub, o log só logado. O Actions mascara os
# secrets nas duas.
set -uo pipefail
mode=${1:?plan ou apply}

fail() {
  local title=$1 out=$2
  echo "$out"
  # anotação tem uma linha só: quebra de linha vira %0A
  local tail_out
  tail_out=$(printf '%s' "$out" | tail -n 15 | sed 's/%/%25/g' | sed ':a;N;$!ba;s/\n/%0A/g')
  echo "::error title=${title}::${tail_out}"
  exit 1
}

missing=()
for v in SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD PROJECT_REF; do
  [ -n "${!v:-}" ] || missing+=("$v")
done
if [ ${#missing[@]} -gt 0 ]; then
  fail "Secrets vazios" "Faltam no repositório (Settings › Secrets › Actions): ${missing[*]}. PROJECT_REF vem de SUPABASE_PROJECT_REF."
fi

out=$(supabase link --project-ref "$PROJECT_REF" -p "$SUPABASE_DB_PASSWORD" 2>&1) || fail "supabase link" "$out"
echo "$out"

if [ "$mode" = apply ]; then
  out=$(supabase db push --include-all --yes -p "$SUPABASE_DB_PASSWORD" 2>&1) || fail "supabase db push" "$out"
  echo "$out"
  exit 0
fi

out=$(supabase db push --dry-run --include-all -p "$SUPABASE_DB_PASSWORD" 2>&1) || fail "supabase db push --dry-run" "$out"
echo "$out"
if echo "$out" | grep -q 'Would push these migrations'; then
  echo "pending=true" >> "$GITHUB_OUTPUT"
  { echo '### Migrations a aplicar'; echo '```'; echo "$out"; echo '```'; } >> "$GITHUB_STEP_SUMMARY"
else
  echo "pending=false" >> "$GITHUB_OUTPUT"
fi
