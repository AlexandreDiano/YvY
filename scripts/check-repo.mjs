/**
 * Regras do projeto que dá para conferir só lendo o repositório. Roda no CI
 * e à mão:
 *
 *   node --experimental-strip-types scripts/check-repo.mjs
 *
 * As regras do banco (anon, auditoria, RLS) ficam em supabase/tests/invariants.sql.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const fails = [];

function walk(dir, out = []) {
  for (const name of readdirSync(join(root, dir))) {
    const p = join(dir, name);
    if (statSync(join(root, p)).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const code = [...walk('app'), ...walk('src')].filter((p) => /\.tsx?$/.test(p));

// 1. Rota dinâmica ([id]) precisa de rewrite na Vercel, senão dá 404 ao abrir
//    o link direto.
const vercel = JSON.parse(read('vercel.json'));
const rewrites = new Set((vercel.rewrites ?? []).map((r) => r.destination));
for (const p of walk('app')) {
  const m = p.match(/^app\/(.+\[[^\]]+\])\.tsx$/);
  if (m && !rewrites.has(`/${m[1]}`)) fails.push(`vercel.json sem rewrite para /${m[1]}`);
}

// 2. Edge Function chamada pelo app precisa liberar o header x-yvy-client no
//    CORS (sem isso o PWA quebra e o APK não; foi o caso de 15/10).
const invoked = new Set();
for (const p of code) {
  for (const m of read(p).matchAll(/functions\.invoke\(\s*['"]([\w-]+)['"]/g)) invoked.add(m[1]);
}
for (const fn of invoked) {
  let src;
  try {
    src = read(`supabase/functions/${fn}/index.ts`);
  } catch {
    fails.push(`app chama a Edge Function ${fn}, que não existe em supabase/functions`);
    continue;
  }
  const allow = src.match(/Access-Control-Allow-Headers['"]?\s*:\s*['"]([^'"]+)/);
  if (!allow || !allow[1].split(',').map((h) => h.trim()).includes('x-yvy-client')) {
    fails.push(`supabase/functions/${fn}: CORS sem x-yvy-client em Access-Control-Allow-Headers`);
  }
}

// 3. Seed do banco igual ao conteúdo editorial de src/data.
const seeds = ['supabase/seed/0002_proposal_cards.sql', 'supabase/seed/0003_fact_checks.sql'];
const before = seeds.map(read);
execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', 'scripts/gen-seed-sql.mjs'], {
  cwd: root,
  stdio: 'ignore',
});
seeds.forEach((p, i) => {
  if (read(p) !== before[i]) fails.push(`${p} estava desatualizado (já regerado: confira e commite)`);
});

// 4. Anonimato: o app nunca lê nem guarda rua.
for (const p of code) {
  if (/\blogradouro\b/.test(read(p))) fails.push(`${p}: usa "logradouro" (rua não circula no app)`);
}

// 5. Nada de biblioteca fora da stack fixada (fonte de ícone, NativeWind, mapa nativo).
const pkg = JSON.parse(read('package.json'));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
for (const banned of ['nativewind', '@expo/vector-icons', '@rnmapbox/maps', 'react-native-maps']) {
  if (deps[banned]) fails.push(`package.json tem ${banned}, fora da stack fixada`);
}

if (fails.length) {
  for (const f of fails) console.error(`erro: ${f}`);
  process.exit(1);
}
console.log(`repo ok (${code.length} arquivos, ${invoked.size} Edge Functions do app)`);
