const CACHE_NAME = 'renea-erp-shell-v344-fleet-form';
const SHELL = ['/manifest.webmanifest', '/favicon.png'];
// JavaScript e CSS usam nomes versionados pelo build e devem seguir direto para a rede.
// O Service Worker guarda somente recursos visuais estáveis.
const STATIC_DESTINATIONS = new Set(['image', 'font', 'manifest']);

const isStaticRequest = request => {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/.netlify/functions/')) return false;
  return STATIC_DESTINATIONS.has(request.destination);
};

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/.netlify/functions/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request));
    return;
  }
  if (!isStaticRequest(request)) return;
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok && response.headers.get('Cache-Control') !== 'no-store') {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});
