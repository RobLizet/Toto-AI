// TOTO AI Service Worker
// Versie wordt automatisch bijgewerkt — cache ververst vanzelf

const SW_VERSION = '3.7';
const CACHE = 'totoai-' + SW_VERSION;

self.addEventListener('install', e => {
  // Activeer direct zonder te wachten op oude SW
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Verwijder alle oude caches met andere versienaam
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE)
          .map(k => {
            console.log('[SW] Oude cache verwijderd:', k);
            return caches.delete(k);
          })
      )
    ).then(() => {
      console.log('[SW] Actief op versie', SW_VERSION);
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', e => {
  // Sla API calls nooit op in cache
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
// NOTIFICATIE KLIK — open app op de juiste wedstrijd
// ═══════════════════════════════════════════════════════
self.addEventListener('notificationclick', e => {
  e.notification.close();

  const data    = e.notification.data || {};
  const matchId = data.matchId || null;
  const comp    = data.comp    || null;

  const baseUrl = self.registration.scope;
  const url = matchId
    ? `${baseUrl}#wedstrijd-${matchId}${comp ? '-' + comp : ''}`
    : baseUrl;

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // App al open? Focus en stuur navigatie bericht
      for (const client of windowClients) {
        if (client.url.startsWith(baseUrl) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIF_CLICK', matchId, comp });
          return;
        }
      }
      // App niet open? Open nieuw venster met hash URL
      if (clients.openWindow) {
        return clients.openWindow(url).then(win => {
          if (win && matchId) {
            setTimeout(() => {
              win.postMessage({ type: 'NOTIF_CLICK', matchId, comp });
            }, 1500);
          }
        });
      }
    })
  );
});
