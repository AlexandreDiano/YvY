// Servidor estático que imita a Vercel (cleanUrls + rewrites de rota dinâmica) para o e2e.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
const root = process.argv[2];
const types = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  p = p.replace(/^\/(acoes|propostas|votacao)\/[^/]+$/, "/$1/[id]").replace(/^\/conversas\/(?!adicionar|bloqueados)[^/]+$/, "/conversas/[id]").replace(/^\/plano\/[^/]+$/, '/plano/[sq]');
  let f = join(root, p);
  if (existsSync(f + '.html')) f += '.html';
  else if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
}).listen(8765, '127.0.0.1');
