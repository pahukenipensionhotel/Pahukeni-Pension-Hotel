self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Pahukeni Notification';
  const options = {
    body: data.message || 'New update from Pahukeni Pension Hotel',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: data.url
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.notification.data) {
    event.waitUntil(clients.openWindow(event.notification.data));
  }
});
