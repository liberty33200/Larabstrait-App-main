self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push reçu !');
  let data = { title: 'Notification', body: 'Nouveau message' };
  
  try {
    data = event.data ? event.data.json() : data;
    console.log('[Service Worker] Données de la notification:', data);
  } catch (e) {
    console.error('[Service Worker] Erreur lors du parsing JSON du push:', e);
    data = { title: 'Notification', body: event.data ? event.data.text() : 'Nouveau message' };
  }
  
  const options = {
    body: data.body,
    icon: '/icon.png',
    badge: '/badge.png',
    data: data.url || '/',
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'Ouvrir l\'application' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => console.log('[Service Worker] Notification affichée avec succès'))
      .catch(err => console.error('[Service Worker] Erreur lors de l\'affichage de la notification:', err))
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      // Si une fenêtre est déjà ouverte, on la focus
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === event.notification.data && 'focus' in client) {
          return client.focus();
        }
      }
      // Sinon on en ouvre une nouvelle
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data);
      }
    })
  );
});
