const CACHE_NAME = 'factufly-shell-v1';
const STATIC_CACHE_NAME = 'factufly-static-v1';
const PAGES_CACHE_NAME = 'factufly-pages-v1';
const APP_SHELL = [
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              key !== CACHE_NAME &&
              key !== STATIC_CACHE_NAME &&
              key !== PAGES_CACHE_NAME,
          )
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Assets estáticos de Next (inmutables por hash): stale-while-revalidate,
  // para que la app pueda arrancar aunque no haya internet desde el inicio.
  // Las llamadas a la API siguen siendo network-first más abajo, sin tocar.
  if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        const networkFetch = fetch(event.request)
          .then((res) => {
            if (res.ok) cache.put(event.request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Navegaciones de página completa (abrir la app, recargar, o lanzarla como
  // PWA instalada): red primero para tener siempre la versión más nueva, pero
  // si no hay internet desde el arranque, se sirve la última copia guardada
  // de esa misma pantalla en vez de fallar con "This site can't be reached".
  // Los datos (productos, ventas, etc.) igual se piden aparte por API y esos
  // SÍ siguen siendo estrictamente red-primero más abajo, sin caché de respaldo.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copia = res.clone();
            caches.open(PAGES_CACHE_NAME).then((cache) => cache.put(event.request, copia));
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(PAGES_CACHE_NAME);
          const cached = await cache.match(event.request);
          return cached || cache.match('/factufly/dashboard');
        })
    );
    return;
  }

  // Red primero para todo lo demás: evita servir datos de facturación desactualizados.
  // Solo se apoya en el cache del app shell si la red falla (offline).
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
