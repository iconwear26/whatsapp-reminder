// Service Worker for Reminder Me App
const CACHE_NAME = 'reminder-me-v7';
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
  '/sounds/sweet-chime.wav',
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

// Push notification received - Bulletproof Native Notification
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
    vibrate: [250, 100, 250, 100, 250],
    tag: 'reminder-' + (data.reminderId || Date.now()),
    renotify: true,
    requireInteraction: true,
    data: { url: '/', reminderId: data.reminderId }
  };

  const notificationPromise = self.registration.showNotification(title, options)
    .catch((err) => {
      // Fallback with minimal options if device refuses extended options
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
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
