// Simple PWA Service Worker for MeuPlayer (Sprint 5)
// Caches shell for basic offline use of the web version (catalog pages may still need network for data)
const CACHE_NAME = 'meuplayer-shell-v1';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/tokens.css',
  '/styles.css',
  '/nav.js',
  '/app.js',
  '/configuracoes.html',
  '/downloads.html',
  '/rede-buzz.html',
  '/canais.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Cache successful navigations and basic assets
        if (res.ok && (req.destination === 'document' || req.destination === 'style' || req.destination === 'script')) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, resClone));
        }
        return res;
      }).catch(() => cached || new Response('Offline', { status: 503 }));
    })
  );
});