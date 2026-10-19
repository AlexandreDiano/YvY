#!/usr/bin/env bash
# Atualização OTA do APK (EAS Update): manda só o JS novo para quem já tem o
# app instalado, sem APK novo. Mudou dependência nativa? O fingerprint muda e
# o update não chega a APK antigo: aí é build novo.
#
#   bash scripts/ota.sh preview "corrige tela de convite"
#   bash scripts/ota.sh production "..."
#
# O bundle do update tem de sair com as mesmas variáveis do APK: as do
# ambiente EAS do perfil (--environment, de onde o build tira o Supabase) e
# o `env` do eas.json (site, captcha, Sentry), que o eas update não lê e por
# isso é exportado aqui.
set -euo pipefail
cd "$(dirname "$0")/.."
channel="${1:?canal: preview ou production}"
message="${2:?mensagem do update}"

eval "$(node -e '
  const p = require("./eas.json").build[process.argv[1]];
  if (!p) { console.error("perfil inexistente no eas.json"); process.exit(1); }
  for (const [k, v] of Object.entries(p.env ?? {})) console.log(`export ${k}=${JSON.stringify(v)}`);
' "$channel")"

npx eas-cli@latest update --channel "$channel" --environment "$channel" --message "$message" --platform android
