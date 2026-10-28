#!/usr/bin/env bash
# Teste de ponta a ponta das conversas (adicionar, aceitar, mensagem cifrada,
# bloquear, denunciar, moderação conferindo assinatura) em navegador de
# verdade, contra o Supabase local. Precisa do Supabase local no ar
# (npm run test:rls:local) e baixa o Chromium headless do Playwright na 1ª vez.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${DOCKER_HOST:-}" ] && ! command -v docker >/dev/null && [ -S "/run/user/$(id -u)/podman/podman.sock" ]; then
  export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
fi
eval "$(npx -y supabase@2.121.0 status -o env | sed -n 's/^\(API_URL\|ANON_KEY\|SERVICE_ROLE_KEY\)=/export LOCAL_\1=/p')"

out=$(mktemp -d)
# --clear: o cache do Metro guarda o EXPO_PUBLIC_* do build anterior (o de produção)
EXPO_PUBLIC_SUPABASE_URL="$LOCAL_API_URL" EXPO_PUBLIC_SUPABASE_ANON_KEY="$LOCAL_ANON_KEY" \
EXPO_PUBLIC_TURNSTILE_SITE_KEY= EXPO_PUBLIC_SENTRY_DSN= EXPO_PUBLIC_SITE_URL=http://127.0.0.1:8765 \
  npx expo export -p web --clear --output-dir "$out" >/dev/null

if [ -z "${CHROME_BIN:-}" ]; then
  npx -y playwright@1.56.1 install chromium-headless-shell >/dev/null
  CHROME_BIN=$(ls -d ~/.cache/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell | tail -1)
fi
export CHROME_BIN

node tests/e2e/serve.mjs "$out" & server=$!
trap 'kill $server 2>/dev/null; rm -rf "$out"' EXIT
sleep 1
node tests/e2e/chat.e2e.mjs
