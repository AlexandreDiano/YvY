/*
 * Service worker do YvY na web. Registrado em app/+html.tsx.
 *
 * Só guarda arquivo do próprio site (HTML, JS, ícones). Nada que vem do
 * Supabase, da Câmara/Senado ou dos tiles do mapa passa por aqui: pedido de
 * outra origem segue direto para a rede. Assim nenhum dado de pessoa entra no
 * cache do navegador (regra 5 do anonimato).
 *
 * - /_expo/static e /assets: nome tem hash, nunca muda → cache primeiro.
 * - Páginas: rede primeiro; sem rede, a última versão guardada.
 * - Resto (ícones, manifest): devolve o guardado e atualiza por trás.
 *
 * Mudou a estratégia? Trocar VERSION, e o cache antigo é apagado.
 */
const VERSION = 'yvy-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(['/', '/manifest.json', '/icons/icon-192.png']))
      .then(() => self.skipWaiting()),
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
    event.respondWith(networkFirst(req));
  } else if (url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(req));
  } else {
    event.respondWith(staleWhileRevalidate(req, event));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req)) || (await cache.match('/')) || Response.error();
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
