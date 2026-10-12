/**
 * Gera os seeds SQL do conteúdo editorial a partir dos arquivos TypeScript.
 *
 * src/data/cards.ts e src/data/factChecks.ts são a fonte única de verdade: o
 * app embute esse conteúdo para funcionar offline, e o banco recebe a mesma
 * coisa. Gerar evita as duas cópias divergirem.
 *
 *   node --experimental-strip-types scripts/gen-seed-sql.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEED_CARDS } from '../src/data/cards.ts';
import { SEED_CHECKS } from '../src/data/factChecks.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Literal SQL com escape de aspas simples. */
const q = (v) => (v === null || v === undefined || v === '' ? 'null' : `'${String(v).replaceAll("'", "''")}'`);

const header = (what, section) => `-- Yvy — ${what}.
--
-- GERADO por scripts/gen-seed-sql.mjs. Não editar à mão: mexa em
-- src/data/*.ts e rode o script de novo.
--
-- Conteúdo transcrito literalmente da seção ${section} de docs/CONTEXT.md,
-- com fonte e data. Mudança de conteúdo é decisão editorial.
`;

const cards = [
  header('cards de propostas', '6.1'),
  '',
  'insert into proposal_cards',
  '  (area, title, what_they_said, source_name, source_date, source_url,',
  '   what_it_means, who_is_affected, comparison, severity, sort_order)',
  'values',
  SEED_CARDS.map(
    (c) =>
      `  (${q(c.area)}, ${q(c.title)}, ${q(c.what_they_said)}, ${q(c.source_name)}, ` +
      `${c.source_date ? `date ${q(c.source_date)}` : 'null'}, ${q(c.source_url)},\n` +
      `   ${q(c.what_it_means)}, ${q(c.who_is_affected)}, ${q(c.comparison)}, ` +
      `${q(c.severity)}, ${c.sort_order})`,
  ).join(',\n'),
  'on conflict do nothing;',
  '',
].join('\n');

const checks = [
  header('base de checagem', '6.2'),
  '',
  'insert into fact_checks (claim_text, result, explanation, source_name, source_url)',
  'values',
  SEED_CHECKS.map(
    (c) =>
      `  (${q(c.claim_text)}, ${q(c.result)}, ${q(c.explanation)}, ${q(c.source_name)}, ${q(c.source_url)})`,
  ).join(',\n'),
  'on conflict do nothing;',
  '',
].join('\n');

writeFileSync(join(root, 'supabase/seed/0002_proposal_cards.sql'), cards);
writeFileSync(join(root, 'supabase/seed/0003_fact_checks.sql'), checks);

console.log(`seed gerado: ${SEED_CARDS.length} cards, ${SEED_CHECKS.length} checagens`);
