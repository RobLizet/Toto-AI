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
  const title = payload.data?.title || '⚡ TOTO AI';
  const body = payload.data?.body || payload.data?.message || '';
  return self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.data?.tag || 'totoai-bg',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: payload.data || {}
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('toto-ai.app') && 'focus' in c) return c.focus();
      }
      return clients.openWindow('https://toto-ai.app/');
    })
  );
});

// Vereist voor Chrome om SW actief te houden bij gesloten app
self.addEventListener('fetch', e => {});
