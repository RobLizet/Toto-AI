// TOTO AI Service Worker v9.8
const SW_VERSION = '9.8';
const CACHE = 'totoai-' + SW_VERSION;

self.addEventListener('install', e => {
  console.log('[SW] Installeren v' + SW_VERSION);
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => {
      console.log('[SW] Actief v' + SW_VERSION);
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', e => {
  if (
    e.request.url.includes('api-sports') ||
    e.request.url.includes('anthropic') ||
    e.request.url.includes('firebase') ||
    e.request.url.includes('workers.dev') ||
    e.request.url.includes('googleapis')
  ) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ── Push ontvangen (van FCM via Firebase) ────────────
self.addEventListener('push', e => {
  console.log('[SW] Push ontvangen!', e.data?.text()?.substring(0, 100));
  if (!e.data) return;

  let payload;
  try { payload = e.data.json(); }
  catch(err) { payload = { title: '⚡ TOTO AI', body: e.data.text() }; }

  // FCM stuurt data in notification of data veld
  const title = payload.notification?.title || payload.title || '⚡ TOTO AI';
  const body  = payload.notification?.body  || payload.body  || '';
  const data  = payload.data || {};

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:    '/Toto-AI/icon-192.png',
      badge:   '/Toto-AI/icon-192.png',
      vibrate: [200, 100, 200, 100, 200],
      tag:     data.tag || 'totoai',
      requireInteraction: true,
      data
    })
  );
});

// ── Notificatie klik ──────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data    = e.notification.data || {};
  const matchId = data.matchId || null;
  const comp    = data.comp    || null;
  const url     = 'https://roblizet.github.io/Toto-AI/';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      for (const w of wins) {
        if (w.url.includes('Toto-AI') && 'focus' in w) {
          w.focus();
          w.postMessage({ type: 'NOTIF_CLICK', matchId, comp });
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
