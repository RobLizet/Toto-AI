// TOTO AI Service Worker v8.7 — met echte VAPID push support
const SW_VERSION = '8.7';
const CACHE = 'totoai-' + SW_VERSION;

self.addEventListener('install', e => { self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => {
      console.log('[SW] Actief op versie', SW_VERSION);
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', e => {
  if (
    e.request.url.includes('api-sports') ||
    e.request.url.includes('anthropic') ||
    e.request.url.includes('firebase') ||
    e.request.url.includes('workers.dev')
  ) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ═══════════════════════════════════════════════════════
// ECHTE PUSH — ontvangt berichten van Cloudflare Worker
// ═══════════════════════════════════════════════════════
self.addEventListener('push', e => {
  if (!e.data) return;

  let payload;
  try { payload = e.data.json(); }
  catch(err) { payload = { title: '⚡ TOTO AI', body: e.data.text() }; }

  const title   = payload.title || '⚡ TOTO AI';
  const options = {
    body:    payload.body    || '',
    icon:    payload.icon    || '/Toto-AI/icon-192.png',
    badge:   payload.badge   || '/Toto-AI/icon-192.png',
    tag:     payload.tag     || 'totoai-push',
    data:    payload.data    || {},
    vibrate: [200, 100, 200],
    requireInteraction: payload.requireInteraction || false,
    actions: payload.actions || []
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

// ═══════════════════════════════════════════════════════
// NOTIFICATIE KLIK
// ═══════════════════════════════════════════════════════
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data    = e.notification.data || {};
  const matchId = data.matchId || null;
  const comp    = data.comp    || null;
  const baseUrl = self.registration.scope;
  const url     = matchId
    ? `${baseUrl}#wedstrijd-${matchId}${comp ? '-' + comp : ''}`
    : baseUrl;

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.startsWith(baseUrl) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIF_CLICK', matchId, comp });
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url).then(win => {
          if (win && matchId) {
            setTimeout(() => win.postMessage({ type: 'NOTIF_CLICK', matchId, comp }), 1500);
          }
        });
      }
    })
  );
});
