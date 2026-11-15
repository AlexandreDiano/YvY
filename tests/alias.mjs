/**
 * Resolve os aliases do tsconfig para os testes rodarem no Node puro, sem
 * bundler: node --import ./tests/alias.mjs --test ...
 *   @/*   -> src/*
 *   @fn/* -> supabase/functions/* (só módulo puro, sem API do Deno)
 */
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';

const roots = [
  ['@fn/', new URL('../supabase/functions/', import.meta.url)],
  ['@/', new URL('../src/', import.meta.url)],
];

registerHooks({
  resolve(specifier, context, nextResolve) {
    for (const [prefix, root] of roots) {
      if (!specifier.startsWith(prefix)) continue;
      for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx', '']) {
        const url = new URL(specifier.slice(prefix.length) + ext, root);
        if (existsSync(url)) return nextResolve(url.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});
