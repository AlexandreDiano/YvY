/**
 * Resolve o alias @/ (tsconfig: "@/*" -> src/*) para os testes rodarem no
 * Node puro, sem bundler: node --import ./tests/alias.mjs --test ...
 */
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';

const src = new URL('../src/', import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx', '']) {
        const url = new URL(specifier.slice(2) + ext, src);
        if (existsSync(url)) return nextResolve(url.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});
