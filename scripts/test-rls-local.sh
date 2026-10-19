#!/usr/bin/env bash
# Roda o test:rls contra o Supabase local (Docker ou Podman), nunca contra a
# produção. Na primeira vez baixa as imagens e demora uns minutos.
#
#   npm run test:rls:local          sobe (se precisar) e roda o teste
#   npm run test:rls:local -- reset  recria o banco do zero antes (migrations + seeds)
#
# Depois do teste de RLS, confere as regras do banco (supabase/tests/invariants.sql).
#
# Com Podman, o socket do usuário precisa estar ligado:
#   systemctl --user enable --now podman.socket
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${DOCKER_HOST:-}" ] && ! command -v docker >/dev/null && [ -S "/run/user/$(id -u)/podman/podman.sock" ]; then
  export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
fi

SUPABASE="npx -y supabase@2.121.0"

if ! $SUPABASE status >/dev/null 2>&1; then
  # SUPABASE_START_ARGS: o CI pula serviços que o teste não usa (-x studio,...)
  $SUPABASE start ${SUPABASE_START_ARGS:-}
elif [ "${1:-}" = "reset" ]; then
  $SUPABASE db reset
fi

# As chaves locais são fixas e públicas (as mesmas para todo mundo); vêm do
# `supabase status` para não depender do .env, que é o de produção.
eval "$($SUPABASE status -o env | sed -n 's/^\(API_URL\|ANON_KEY\|SERVICE_ROLE_KEY\)=/LOCAL_\1=/p')"

EXPO_PUBLIC_SUPABASE_URL="$LOCAL_API_URL" \
EXPO_PUBLIC_SUPABASE_ANON_KEY="$LOCAL_ANON_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$LOCAL_SERVICE_ROLE_KEY" \
  node --experimental-strip-types supabase/tests/rls.test.ts

# psql de dentro do container do banco: não precisa de cliente instalado.
ENGINE=docker
command -v docker >/dev/null || ENGINE=podman
$ENGINE exec -i supabase_db_yvy psql -U postgres -v ON_ERROR_STOP=1 -q -At < supabase/tests/invariants.sql
