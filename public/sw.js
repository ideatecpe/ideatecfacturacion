const CACHE_NAME = 'factufly-shell-v3';
const STATIC_CACHE_NAME = 'factufly-static-v3';
const PAGES_CACHE_NAME = 'factufly-pages-v3';
const IMAGES_CACHE_NAME = 'factufly-images-v3';
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
              key !== PAGES_CACHE_NAME &&
              key !== IMAGES_CACHE_NAME,
          )
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// El agente de impresión corre en la propia PC del cajero. Sus llamadas no se
// cachean ni se interceptan: cuando no está instalado la conexión se rechaza al
// instante, y eso es justo lo que la app necesita saber para caer al diálogo del
// navegador.
const PUERTO_AGENTE_IMPRESION = '9631';

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (url.port === PUERTO_AGENTE_IMPRESION &&
      (url.hostname === '127.0.0.1' || url.hostname === 'localhost')) {
    return;
  }

  // 1. Assets estáticos de Next (inmutables por hash)
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

  // 2. Imágenes de productos (Cloudflare Images, storage local/remoto, etc.)
  const esImagen =
    event.request.destination === 'image' ||
    url.hostname.includes('imagedelivery.net') ||
    url.pathname.match(/\.(jpg|jpeg|png|webp|gif|svg|ico)$/i);

  if (esImagen) {
    event.respondWith(
      caches.open(IMAGES_CACHE_NAME).then(async (cache) => {
        try {
          const res = await fetch(event.request);
          // Si la respuesta es exitosa (incluso respuestas opacas de CDNs externos), guardarla en caché
          if (res.ok || res.type === 'opaque') {
            cache.put(event.request, res.clone());
          }
          return res;
        } catch {
          // Sin internet: recuperar la imagen guardada en caché
          const cached = await cache.match(event.request);
          if (cached) return cached;
          return new Response('', { status: 404, statusText: 'Offline Image Not Found' });
        }
      })
    );
    return;
  }

  // 3. Navegaciones de página completa
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
  event.respondWith(
    fetch(event.request).catch(async () => {
      // `caches.match` devuelve undefined cuando no hay copia guardada, y
      // `respondWith(undefined)` revienta con "Failed to convert value to
      // 'Response'". Siempre se responde algo, aunque sea un 504.
      const cached = await caches.match(event.request);
      return cached || new Response('', { status: 504, statusText: 'Sin conexión' });
    })
  );
});
