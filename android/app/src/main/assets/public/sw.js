// Service Worker for ReminderMe App (PWA)
const CACHE_NAME = 'reminderme-pwa-v10';
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
  '/sounds/sweet_chime.wav',
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
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[SW] Cache addAll warning (non-fatal):', err);
      });
    })
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
  // Never intercept API endpoints or external payment gateways
  if (e.request.url.includes('/api/') || e.request.url.includes('razorpay.com')) {
    return;
  }

  // Network first with cache fallback for navigation / documents
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(e.request).then(cached => cached || caches.match('/index.html') || caches.match('/')))
    );
    return;
  }

  // Stale-while-revalidate for static assets
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      const fetchPromise = fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const toCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, toCache));
        }
        return networkResponse;
      }).catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});

// Push notification received - Bulletproof Native Lock-Screen Notification
self.addEventListener('push', (e) => {
  let data = { title: '🔔 ReminderMe', body: 'You have a scheduled reminder!' };
  if (e.data) {
    try {
      data = e.data.json();
    } catch (err) {
      data.body = e.data.text();
    }
  }

  const title = data.title || '🔔 ReminderMe';
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
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
