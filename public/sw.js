/*
 * Service worker do YvY na web. Registrado em app/+html.tsx.
 *
 * Só guarda arquivo do próprio site (HTML, JS, ícones). Nada que vem do
 * Supabase, da Câmara/Senado ou dos tiles do mapa passa por aqui: pedido de
 * outra origem segue direto para a rede. Assim nenhum dado de pessoa entra no
 * cache do navegador (regra 5 do anonimato). Conteúdo público (cards,
 * checagem) já tem cache próprio no app (src/lib/cache.ts) + seed embutido.
 *
 * - Instalação: baixa tudo de /precache.json (gerado na build por
 *   scripts/precache.mjs) — o app abre sem internet já na visita seguinte.
 * - /_expo/static e /assets: nome tem hash, nunca muda → cache primeiro.
 * - Páginas: rede primeiro; sem rede, a última versão guardada ou o início.
 * - Resto (ícones, manifest): devolve o guardado e atualiza por trás.
 *
 * VERSION é trocada a cada build pelo scripts/precache.mjs: arquivo novo =
 * service worker novo = cache velho apagado no activate.
 */
const VERSION = 'yvy-__PRECACHE_VERSION__';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      let files = ['/', '/manifest.json', '/icons/icon-192.png'];
      try {
        const res = await fetch('/precache.json', { cache: 'no-store' });
        if (res.ok) files = (await res.json()).files;
      } catch {
        // sem lista (dev local): fica o mínimo
      }
      // Um arquivo que falhe não derruba a instalação inteira.
      // Arquivo com hash (_expo/static) nunca muda: pode vir do cache HTTP —
      // a página acabou de baixar o JS principal, baixar de novo dobraria o
      // custo da primeira visita no 3G. Página e manifest vêm frescos.
      await Promise.all(
        files.map((f) =>
          fetch(f, { cache: f.startsWith('/_expo/static/') ? 'default' : 'reload' })
            .then((r) => (r.ok ? cache.put(f, r) : undefined))
            .catch(() => undefined),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, url));
  } else if (url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(req));
  } else {
    event.respondWith(staleWhileRevalidate(req, event));
  }
});

async function networkFirst(req, url) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(url.pathname, res.clone());
    return res;
  } catch {
    // Sem rede: a página guardada; senão o início, e o roteador do app
    // desenha a rota certa a partir da URL.
    return (await cache.match(url.pathname)) || (await cache.match('/')) || Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, event) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const update = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit || Response.error());
  if (hit) {
    event.waitUntil(update);
    return hit;
  }
  return update;
}
