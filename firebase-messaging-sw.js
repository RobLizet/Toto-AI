importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyB7K4SXPdxHSPIvFyXOfY2bpehcNnjRM-M',
  projectId: 'toto-ai-397cb',
  messagingSenderId: '426083019907',
  appId: '1:426083019907:web:8f32f8037628d63cbbbfb6'
});

const messaging = firebase.messaging();

// Belangrijk: Gebruik de background handler voor het geval je 'data-only' payloads stuurt
messaging.onBackgroundMessage(payload => {
  console.log('[FCM-SW] Achtergrond push ontvangen:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || '⚡ TOTO AI';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || payload.data?.message || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.data?.tag || 'totoai-bg',
    requireInteraction: true,
    data: payload.data
  };

  // Gebruik self.registration om de notificatie te tonen
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Klik afhandeling
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const targetUrl = 'https://toto-ai.app/';
  
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url.includes('toto-ai.app') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
