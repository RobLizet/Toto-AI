// ProMatchXI Service Worker v25.2 — Cache bust bij elke deploy
const SW_VERSION = '36.245';
const CACHE = 'totoai-' + SW_VERSION;

self.addEventListener('install', e => { self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('api-sports') ||
      e.request.url.includes('anthropic') ||
      e.request.url.includes('firebase') ||
      e.request.url.includes('workers.dev') ||
      e.request.url.includes('googleapis')) return;
  // JS/CSS bestanden altijd network-first — nooit stale cache
  if (e.request.url.match(/\.(js|css)(\?|$)/)) {
    e.respondWith(
      fetch(e.request)
        .then(r => { const c = r.clone(); caches.open(CACHE).then(cache => cache.put(e.request, c)); return r; })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
});

// ── Standaard Web Push ────────────────────────────────
self.addEventListener('push', e => {
  console.log('[SW] Push ontvangen!');
  if (!e.data) return;
  let payload;
  try { payload = e.data.json(); }
  catch(err) { payload = { title: '⚡ ProMatchXI', body: e.data.text() }; }

  const title = payload.notification?.title || payload.title || '⚡ ProMatchXI';
  const body  = payload.notification?.body  || payload.body  || '';
  const data  = payload.data || {};

  e.waitUntil(
    self.registration.showNotification(title, {
      body, icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'totoai',
      requireInteraction: true,
      data
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      for (const w of wins) {
        if (w.url.includes(self.location.origin) && 'focus' in w) { w.focus(); return; }
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

