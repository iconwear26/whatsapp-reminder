// Service Worker for Reminder Me App
const CACHE_NAME = 'reminder-me-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
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
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/')) return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// Push notification received
self.addEventListener('push', (e) => {
  let data = { title: '🔔 Reminder Me', body: 'You have a scheduled reminder!' };
  if (e.data) {
    try {
      data = e.data.json();
    } catch (err) {
      data.body = e.data.text();
    }
  }

  const options = {
    body: data.body || 'Scheduled task is due now.',
    icon: '/icons/icon.svg',
    badge: '/icons/icon.svg',
    image: data.image || '/images/art_morning_sun.jpg',
    vibrate: [250, 100, 250, 100, 250],
    sound: '/sounds/sweet-chime.wav',
    tag: 'reminder-' + (data.data?.reminderId || Date.now()),
    renotify: true,
    requireInteraction: true,
    data: { url: '/', reminderId: data.data?.reminderId },
    actions: [
      { action: 'open', title: 'Open & Read 🌸' }
    ]
  };

  e.waitUntil(
    self.registration.showNotification(data.title || '🔔 Reminder Me', options)
  );
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
