// Depois do `expo export -p web`: grava dist/precache.json com o que o
// service worker (public/sw.js) baixa ao instalar — páginas de entrada,
// todo JS/CSS de _expo/static e os ícones. Assim o PWA abre sem internet já
// depois da primeira visita, sem depender de adivinhar nome de arquivo com hash.
//
//   node scripts/precache.mjs [pasta]   (padrão: dist)

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.argv[2] ?? 'dist';

// Páginas que fazem sentido abrir offline (o resto do app é navegação
// dentro do JS, que já estará em cache).
const PAGES = ['/', '/welcome', '/publico', '/checar', '/propostas', '/instalar', '/entrar'];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const assets = walk(join(root, '_expo', 'static'))
  .concat(walk(join(root, 'icons')))
  .map((p) => '/' + relative(root, p).split(sep).join('/'));

const files = [...PAGES, '/manifest.json', ...assets];

// Versão muda quando qualquer arquivo muda: o SW novo apaga o cache velho.
const hash = createHash('sha256');
for (const f of assets.sort()) hash.update(f).update(readFileSync(join(root, f)));

const version = hash.digest('hex').slice(0, 12);
writeFileSync(join(root, 'precache.json'), JSON.stringify({ version, files }));

// sw.js com a versão desta build: o navegador só reinstala o service worker
// quando o arquivo muda.
const swPath = join(root, 'sw.js');
writeFileSync(swPath, readFileSync(swPath, 'utf8').replace('__PRECACHE_VERSION__', version));
console.log(`precache.json: ${files.length} arquivos · sw ${version}`);
