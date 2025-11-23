// Konfigurasi
const CACHE_NAME = 'offline-scanner-v6';
const RUNTIME_CACHE = 'runtime-cache';
const API_CACHE = 'api-cache';
const OFFLINE_URL = 'offline.html';
const APP_PREFIX = 'offline-scanner';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyiFqaZL3D0MY5xfxQEiDy-OVP02EUGKvI95E0qiADP9cb1e7LVqNxoUndxT-IBZ6k/exec';

// Daftar aset yang akan di-cache saat instalasi
const PRECACHE_ASSETS = [
  'index.html',
  'login.html',
  'manifest.json',
  'database.js',
  'offline.html',
  'config.js',
  'Assets/images/logo.png',
  'Assets/images/logo-512.png',
  'Assets/style.css',
  'Assets/js.css'
];

// Daftar aset eksternal yang akan di-cache
const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://unpkg.com/html5-qrcode@2.3.4/minified/html5-qrcode.min.js'
];

// Install Event - Cache semua aset penting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // Cache aset utama
        return cache.addAll([...PRECACHE_ASSETS, ...EXTERNAL_ASSETS]);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event - Hapus cache lama
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME, RUNTIME_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => self.clients.claim())
  );
});

// Fetch Event - Strategi Cache First dengan fallback ke network
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // Skip untuk permintaan non-GET dan chrome-extension
  if (event.request.method !== 'GET' || requestUrl.protocol === 'chrome-extension:') {
    return;
  }
  
  // Handle API requests to Google Apps Script
  if (requestUrl.href.includes(GAS_URL)) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone the response before consuming it
          const responseToCache = response.clone();
          
          // Cache the API response
          caches.open(API_CACHE).then(cache => {
            cache.put(event.request, responseToCache);
          });
          
          return response;
        })
        .catch(() => {
          // If fetch fails, try to get from cache
          return caches.match(event.request).then(cachedResponse => {
            return cachedResponse || new Response(JSON.stringify({
              status: 'error',
              message: 'Tidak dapat terhubung ke server. Anda sedang offline.'
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // Untuk aset statis, gunakan cache first
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // Mengembalikan respons dari cache jika tersedia
      if (cachedResponse) {
        return cachedResponse;
      }

      // Jika tidak ada di cache, ambil dari jaringan
      return fetch(event.request).then(response => {
        // Periksa apakah respons valid
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone respons untuk disimpan di cache
        const responseToCache = response.clone();
        caches.open(RUNTIME_CACHE).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Jika offline dan permintaan adalah navigasi, tampilkan halaman offline
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
        return new Response('You are offline and the requested resource is not in cache.');
      });
    })
  );
});

// Sync Event - Menangani sinkronisasi data saat online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queue') {
    event.waitUntil(processSyncQueue());
  }
});

// Fungsi untuk memproses antrian sinkronisasi
async function processSyncQueue() {
  // Implementasi sinkronisasi dengan server
  console.log('Processing sync queue...');
  
  // Di sini Anda dapat menambahkan logika untuk menyinkronkan data dengan server
  // Misalnya, mengirim data yang disimpan di IndexedDB ke server
  
  return Promise.resolve();
}

// Push Notification
self.addEventListener('push', (event) => {
  const options = {
    body: event.data?.text() || 'Notifikasi baru dari Offline Scanner',
    icon: '/Assets/images/logo-512.png',
    badge: '/Assets/images/logo-512.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 'push-notification'
    }
  };

  event.waitUntil(
    self.registration.showNotification('Offline Scanner', options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});
