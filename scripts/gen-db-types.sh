#!/usr/bin/env bash
# Regera src/lib/db.generated.ts (tipo Database do cliente Supabase) a partir
# do banco local, que tem exatamente as migrations do repo. Rodar depois de
# mexer em migration, com o Supabase local no ar (npm run test:rls:local).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${DOCKER_HOST:-}" ] && ! command -v docker >/dev/null && [ -S "/run/user/$(id -u)/podman/podman.sock" ]; then
  export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
fi

out=src/lib/db.generated.ts
# Temporário fora do repo: o prettier 3 respeita o .gitignore e devolve sem
# formatar um arquivo ignorado (um .gitignore local com *.tmp bastava).
tmp=$(mktemp --suffix=.ts)
trap 'rm -f "$tmp"' EXIT
{
  echo '// GERADO por scripts/gen-db-types.sh a partir das migrations. Não editar à mão.'
  npx -y supabase@2.121.0 gen types typescript --local --schema public 2>/dev/null
} > "$tmp"
npx -y prettier@3.6.2 --parser typescript --single-quote --print-width 120 "$tmp" > "$out"
