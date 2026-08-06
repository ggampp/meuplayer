// MeuPlayer PWA Service Worker
// Network-first for JS/CSS so hub/nav updates are never stuck behind shell cache.
const CACHE_NAME = 'meuplayer-shell-v3-hub';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/tokens.css',
  '/styles.css',
  '/css/hub.css',
  '/css/base.css',
  '/js/nav.js',
  '/js/app.js',
  '/configuracoes.html',
  '/downloads.html',
  '/rede-buzz.html',
  '/canais.html',
  '/player.html',
];

// Always try network first for these (nav hub, styles, app logic)
function isVolatileAsset(url) {
  try {
    const u = new URL(url);
    const p = u.pathname;
    return (
      p.endsWith('.js') ||
      p.endsWith('.css') ||
      p.startsWith('/css/') ||
      p === '/nav.js' ||
      p === '/sw.js'
    );
  } catch {
    return false;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Bypass SW for API / dynamic data
  try {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) return;
  } catch {
    /* ignore */
  }

  // Network-first for scripts/styles so platform hub always updates
  if (isVolatileAsset(req.url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || new Response('Offline', { status: 503 })))
    );
    return;
  }

  // Cache-first for documents/images (offline shell)
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok && (req.destination === 'document' || req.destination === 'image')) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => cached || new Response('Offline', { status: 503 }));

      return cached || network;
    })
  );
});
