/* Abitare Co. Tool - service worker con caching CDN */

const CACHE_NAME = 'abitare-tools-cdn-v1';

const CDN_PATTERNS = [
  'cdnjs.cloudflare.com/ajax/libs/jszip',
  'cdn.jsdelivr.net/npm/mp4box',
  'unpkg.com/pdf-lib',
  'unpkg.com/@pdf-lib/fontkit',
  'cdnjs.cloudflare.com/ajax/libs/qrcodejs',
  'cdn.jsdelivr.net/npm/pptxgenjs'
];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  const isCDN = CDN_PATTERNS.some(p => url.includes(p));

  if (!isCDN) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        });
      })
    )
  );
});

/* version: 20260616_caching1 */
