const CACHE = 'totoai-v4';
const ASSETS = [
  '/Toto-AI/',
  '/Toto-AI/index.html',
  '/Toto-AI/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => {
        console.log('Deleting old cache:', k);
        return caches.delete(k);
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Altijd netwerk voor API calls en fonts
  const url = e.request.url;
  if (url.includes('api.anthropic.com') ||
      url.includes('api-sports.io') ||
      url.includes('football-data.org') ||
      url.includes('fonts.googleapis.com') ||
      url.includes('fonts.gstatic.com')) {
    return;
  }
  // Netwerk-eerst voor HTML (zodat updates altijd doorkomen)
  if (url.includes('.html') || url.endsWith('/Toto-AI/') || url.endsWith('/Toto-AI')) {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return resp;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  // Cache-eerst voor de rest
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
