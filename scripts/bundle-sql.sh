#!/usr/bin/env bash
# Concatena migrations + seeds na ordem para aplicar de uma vez.
#
# Serve para colar no SQL Editor do Supabase ou mandar por psql. O arquivo
# gerado é descartável: a fonte continua sendo supabase/migrations e
# supabase/seed.
#
#   bash scripts/bundle-sql.sh > supabase/apply_all.sql
set -euo pipefail
cd "$(dirname "$0")/.."

echo "-- Yvy — bundle gerado por scripts/bundle-sql.sh em $(date -Iseconds)"
echo "-- Aplicar em banco novo. Ordem importa."
echo

for f in supabase/migrations/*.sql supabase/seed/*.sql; do
  echo "-- ============================================================"
  echo "-- $f"
  echo "-- ============================================================"
  cat "$f"
  echo
done
