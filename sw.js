// TOTO AI Service Worker v3.7
// Handles push notifications + offline caching + notification click deeplinks

const CACHE = 'totoai-v3';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Cache-first for same-origin assets, network-first for API calls
  if (e.request.url.includes('api-sports') || e.request.url.includes('anthropic')) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ═══════════════════════════════════════════════════════
// NOTIFICATIE KLIK — open app op de juiste wedstrijd
// ═══════════════════════════════════════════════════════
self.addEventListener('notificationclick', e => {
  e.notification.close();

  const data     = e.notification.data || {};
  const matchId  = data.matchId || null;
  const comp     = data.comp    || null;

  // Build URL with hash so the app knows what to open
  const baseUrl = self.registration.scope; // e.g. https://zweet.../Toto-AI/
  const url = matchId
    ? `${baseUrl}#wedstrijd-${matchId}${comp ? '-' + comp : ''}`
    : baseUrl;

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Focus existing window if open
      for (const client of windowClients) {
        if (client.url.startsWith(baseUrl) && 'focus' in client) {
          client.focus();
          // Send message to app to navigate
          client.postMessage({
            type: 'NOTIF_CLICK',
            matchId,
            comp
          });
          return;
        }
      }
      // Open new window if app not open
      if (clients.openWindow) {
        return clients.openWindow(url).then(win => {
          if (win && matchId) {
            // Small delay for app to initialize, then send navigation message
            setTimeout(() => {
              win.postMessage({ type: 'NOTIF_CLICK', matchId, comp });
            }, 1500);
          }
        });
      }
    })
  );
});
