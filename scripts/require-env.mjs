/**
 * Trava o build da Vercel quando falta variável do Supabase. Sem elas o
 * export sai em modo local (qualquer convite passa, nada vai ao banco) e
 * ninguém percebe até alguém tentar entrar. Ver src/lib/env.ts.
 *
 *   node scripts/require-env.mjs
 */
const required = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];
const missing = required.filter((k) => !process.env[k]?.trim());

if (missing.length) {
  console.error(`Build parado: falta ${missing.join(', ')} no ambiente.`);
  console.error('Configurar em Vercel › Project Settings › Environment Variables.');
  process.exit(1);
}
