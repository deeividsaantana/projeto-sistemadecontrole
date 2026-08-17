const CACHE_NAME = 'renea-erp-shell-v342';
const SHELL = ['/manifest.webmanifest', '/favicon.png'];
const STATIC_PATHS = ['/assets/'];
const STATIC_DESTINATIONS = new Set(['script', 'style', 'image', 'font', 'manifest']);

const isStaticRequest = request => {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/.netlify/functions/')) return false;
  if (STATIC_PATHS.some(path => url.pathname.startsWith(path))) return true;
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
