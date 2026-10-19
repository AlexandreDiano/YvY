/**
 * Teto do JS que o site baixa antes de abrir (os <script> do index.html),
 * medido com gzip. O app precisa abrir em 3G: cada 100 KB a mais é ~1 s.
 *
 *   node scripts/bundle-budget.mjs dist
 *
 * Subiu de propósito? Ajuste BUDGET_KB aqui no mesmo commit, com o motivo.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 760; // 19/10: 704 KB

const dist = process.argv[2] ?? 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script[^>]+src="\/?([^"]+\.js)"/g)].map((m) => m[1]);
if (!scripts.length) {
  console.error('nenhum <script src> no index.html: o export mudou de formato?');
  process.exit(1);
}

let total = 0;
for (const src of scripts) {
  const kb = gzipSync(readFileSync(join(dist, src)), { level: 9 }).length / 1024;
  total += kb;
  console.log(`${kb.toFixed(0).padStart(6)} KB  ${src}`);
}
console.log(`${total.toFixed(0).padStart(6)} KB  total (teto ${BUDGET_KB} KB)`);
if (total > BUDGET_KB) {
  console.error('JS inicial passou do teto.');
  process.exit(1);
}
