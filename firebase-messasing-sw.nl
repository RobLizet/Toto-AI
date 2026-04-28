// Firebase Messaging SW — TOTO AI
// Dit bestand MOET in de root van de GitHub repo staan
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyB7K4SXPdxHSPIvFyXOfY2bpehcNnjRM-M',
  projectId: 'toto-ai-397cb',
  messagingSenderId: '426083019907',
  appId: '1:426083019907:web:8f32f8037628d63cbbbfb6'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  console.log('[FCM-SW] Achtergrond push:', payload);
  const n = payload.notification || {};
  const d = payload.data || {};
  self.registration.showNotification(n.title || '⚡ TOTO AI', {
    body:    n.body || d.message || '',
    icon:    '/Toto-AI/icon-192.png',
    badge:   '/Toto-AI/icon-192.png',
    vibrate: [200, 100, 200],
    tag:     d.tag || 'totoai-bg',
    requireInteraction: true,
    data: d
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      for (const w of wins) {
        if (w.url.includes('Toto-AI') && 'focus' in w) { w.focus(); return; }
      }
      if (clients.openWindow) return clients.openWindow('https://roblizet.github.io/Toto-AI/');
    })
  );
});
