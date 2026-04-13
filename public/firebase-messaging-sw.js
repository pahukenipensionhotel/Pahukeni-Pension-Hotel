importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Firebase config (copied from firebase-applet-config.json)
firebase.initializeApp({
  apiKey: "AIzaSyAJwMmPs75DEpxa5nppH_sc5RkbL-XO7Rk",
  authDomain: "ai-studio-applet-webapp-a6a81.firebaseapp.com",
  projectId: "ai-studio-applet-webapp-a6a81",
  storageBucket: "ai-studio-applet-webapp-a6a81.firebasestorage.app",
  messagingSenderId: "262297782313",
  appId: "1:262297782313:web:be78f915378d95faae7438"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notification = payload.notification || {};
  const title = notification.title || 'Notification';
  const options = {
    body: notification.body || payload.data?.message || '',
    data: payload.data || {},
    // Add other options like icon here if desired
  };
  self.registration.showNotification(title, options);
});

// Optional: handle notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const clickAction = event.notification?.data?.click_action || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url === clickAction && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(clickAction);
    })
  );
});

// Handle pushsubscriptionchange - notify clients to refresh token
self.addEventListener('pushsubscriptionchange', function(event) {
  console.log('[firebase-messaging-sw.js] pushsubscriptionchange event', event);
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGE' });
      }
    })
  );
});
