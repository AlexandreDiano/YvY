#!/usr/bin/env bash
# Remove do checkout do CI as migrations listadas em
# supabase/migrations-hold.txt, para o db push da produção não aplicá-las.
set -euo pipefail
cd "$(dirname "$0")/.."
sed 's/#.*//' supabase/migrations-hold.txt | while read -r v; do
  [ -n "$v" ] || continue
  for f in supabase/migrations/"$v"_*.sql; do
    [ -e "$f" ] && { echo "em espera: $f"; rm "$f"; }
  done
done
