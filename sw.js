// TOTO AI Service Worker v9.1 — FCM + VAPID push
const SW_VERSION = '9.1';
const CACHE = 'totoai-' + SW_VERSION;

// Firebase Messaging in service worker
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyB7K4SXPdxHSPIvFyXOfY2bpehcNnjRM-M',
  projectId: 'toto-ai-397cb',
  messagingSenderId: '426083019907',
  appId: '1:426083019907:web:8f32f8037628d63cbbbfb6'
});

const messaging = firebase.messaging();

// ── FCM achtergrond berichten ─────────────────────────
messaging.onBackgroundMessage(payload => {
  console.log('[SW FCM] Achtergrond bericht:', payload);
  const n = payload.notification || {};
  const data = payload.data || {};
  self.registration.showNotification(n.title || '⚡ TOTO AI', {
    body: n.body || '',
    icon: '/Toto-AI/icon-192.png',
    badge: '/Toto-AI/icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'totoai-fcm',
    requireInteraction: true,
    data
  });
});

// ── Cache ─────────────────────────────────────────────
self.addEventListener('install', e => { self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => {
      console.log('[SW] Actief v', SW_VERSION);
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

// ── Push (VAPID fallback) ─────────────────────────────
self.addEventListener('push', e => {
  if (!e.data) return;
  let payload;
  try { payload = e.data.json(); }
  catch(err) { payload = { title: '⚡ TOTO AI', body: e.data.text() }; }
  e.waitUntil(self.registration.showNotification(payload.title || '⚡ TOTO AI', {
    body: payload.body || '',
    icon: '/Toto-AI/icon-192.png',
    badge: '/Toto-AI/icon-192.png',
    vibrate: [200, 100, 200],
    tag: payload.tag || 'totoai',
    data: payload.data || {}
  }));
});

// ── Notificatie klik ──────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {};
  const matchId = data.matchId || null;
  const comp = data.comp || null;
  const baseUrl = 'https://roblizet.github.io/Toto-AI/';

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
        return clients.openWindow(baseUrl).then(win => {
          if (win && matchId) {
            setTimeout(() => win.postMessage({ type: 'NOTIF_CLICK', matchId, comp }), 1500);
          }
        });
      }
    })
  );
});
