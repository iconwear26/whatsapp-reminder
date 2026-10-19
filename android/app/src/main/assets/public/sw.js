// Service Worker for Reminder Me App
const CACHE_NAME = 'reminder-me-v8';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/badge-96.png',
  '/icons/icon.svg',
  '/images/art_morning_sun.jpg',
  '/images/art_mountain_sunrise.jpg',
  '/images/art_lotus_water.jpg',
  '/images/art_sakura_blossom.jpg',
  '/images/art_lavender_sunset.jpg',
  '/images/art_zen_water_stones.jpg'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE).catch(err => console.log('Cache addAll notice:', err)))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/')) return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// Push notification received - Bulletproof Native Lock-Screen Notification
self.addEventListener('push', (e) => {
  let data = { title: '🔔 Reminder Me', body: 'You have a scheduled reminder!' };
  if (e.data) {
    try {
      data = e.data.json();
    } catch (err) {
      data.body = e.data.text();
    }
  }

  const title = data.title || '🔔 Reminder Me';
  const options = {
    body: data.body || 'Scheduled task is due now.',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    vibrate: [300, 150, 300, 150, 300],
    tag: 'reminder-' + (data.reminderId || Date.now()),
    renotify: true,
    requireInteraction: true,
    data: { url: '/', reminderId: data.reminderId, reminder: data },
    actions: [
      { action: 'open', title: 'Open 🌸' },
      { action: 'done', title: 'Done ✓' }
    ]
  };

  // Broadcast to any open tabs so in-app modal appears immediately
  clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
    windowClients.forEach((client) => {
      client.postMessage({ type: 'PUSH_REMINDER_TRIGGER', data });
    });
  });

  const notificationPromise = self.registration.showNotification(title, options)
    .catch((err) => {
      console.error('[SW] Primary showNotification failed, trying fallback:', err);
      return self.registration.showNotification(title, {
        body: options.body,
        icon: '/icons/icon-192.png'
      });
    });

  e.waitUntil(notificationPromise);
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const remId = e.notification.data ? e.notification.data.reminderId : null;

  if (e.action === 'done' && remId) {
    e.waitUntil(
      fetch(`/api/reminders/${remId}/dismiss`, { method: 'POST' }).catch(() => {})
    );
    return;
  }

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('/') && 'focus' in client) {
          if (remId) {
            client.postMessage({ type: 'OPEN_REMINDER_MODAL', reminderId: remId });
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
