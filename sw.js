// TOTO AI Service Worker v9.9 — FCM ingebouwd
const SW_VERSION = '9.9';
const CACHE = 'totoai-' + SW_VERSION;

// Firebase in service worker laden
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Firebase initialiseren
firebase.initializeApp({
  apiKey: 'AIzaSyB7K4SXPdxHSPIvFyXOfY2bpehcNnjRM-M',
  projectId: 'toto-ai-397cb',
  messagingSenderId: '426083019907',
  appId: '1:426083019907:web:8f32f8037628d63cbbbfb6'
});

const messaging = firebase.messaging();

// ── FCM achtergrond push ──────────────────────────────
messaging.onBackgroundMessage(payload => {
  console.log('[SW] FCM achtergrond bericht:', payload);
  const n = payload.notification || {};
  const d = payload.data || {};
  self.registration.showNotification(n.title || '⚡ TOTO AI', {
    body:    n.body || d.message || '',
    icon:    '/Toto-AI/icon-192.png',
    badge:   '/Toto-AI/icon-192.png',
    vibrate: [200, 100, 200],
    tag:     d.tag || 'totoai-fcm',
    requireInteraction: true,
    data: d
  });
});

// ── Cache ─────────────────────────────────────────────
self.addEventListener('install', e => {
  console.log('[SW] v' + SW_VERSION);
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
  if (e.request.url.includes('api-sports') ||
      e.request.url.includes('anthropic') ||
      e.request.url.includes('firebase') ||
      e.request.url.includes('workers.dev') ||
      e.request.url.includes('googleapis')) return;
  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
});

// ── Notificatie klik ──────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = 'https://roblizet.github.io/Toto-AI/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      for (const w of wins) {
        if (w.url.includes('Toto-AI') && 'focus' in w) { w.focus(); return; }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
