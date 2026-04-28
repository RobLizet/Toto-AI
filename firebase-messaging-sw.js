// Firebase Messaging Service Worker voor TOTO AI
// Upload dit bestand naar de ROOT van je GitHub repo (naast index.html)

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyB7K4SXPdxHSPIvFyXOfY2bpehcNnjRM-M',
  projectId: 'toto-ai-397cb',
  messagingSenderId: '426083019907',
  appId: '1:426083019907:web:totoai'
});

const messaging = firebase.messaging();

// Ontvang push als app GESLOTEN is
messaging.onBackgroundMessage(payload => {
  console.log('[FCM SW] Achtergrond bericht:', payload);
  const n = payload.notification || {};
  const data = payload.data || {};

  self.registration.showNotification(n.title || '⚡ TOTO AI', {
    body: n.body || '',
    icon: '/Toto-AI/icon-192.png',
    badge: '/Toto-AI/icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'totoai-bg',
    requireInteraction: true,
    data: { ...data, url: 'https://roblizet.github.io/Toto-AI/' }
  });
});

// Klik op melding
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || 'https://roblizet.github.io/Toto-AI/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      for (const w of wins) {
        if (w.url.includes('Toto-AI') && 'focus' in w) { w.focus(); return; }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
