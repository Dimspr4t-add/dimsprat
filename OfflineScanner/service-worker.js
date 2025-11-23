// Konfigurasi
const CACHE_NAME = 'offline-scanner-v8';
const RUNTIME_CACHE = 'runtime-cache-v2';
const API_CACHE = 'api-cache-v2';
const OFFLINE_URL = 'offline.html';
const APP_PREFIX = 'offline-scanner';

// Daftar aset yang akan di-cache saat instalasi
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './login.html',
  './manifest.json',
  './database.js',
  './sync-service.js',
  './offline.html',
  './config.js',
  './Assets/images/logo.png',
  './Assets/images/logo-512.png',
  './Assets/style.css',
  './Assets/js.css'
];

// Daftar aset eksternal yang akan di-cache
const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Orbitron:wght@500;700&display=swap',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

// Install Event - Cache semua aset penting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Membuka cache untuk instalasi');
        // Cache aset utama
        return cache.addAll([...PRECACHE_ASSETS, ...EXTERNAL_ASSETS]);
      })
      .then(() => {
        console.log('Semua aset berhasil di-cache');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Gagal meng-cache aset:', error);
      })
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
            console.log('Menghapus cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      // Klaim klien untuk mengontrol semua tab yang terbuka
      return self.clients.claim();
    })
    .then(() => {
      console.log('Service Worker aktif dan siap menangani fetch');
      // Paksa update pada semua klien
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SW_ACTIVATED' });
        });
      });
    })
  );
});

// Event untuk sinkronisasi latar belakang
self.addEventListener('sync', (event) => {
  console.log('Event sinkronisasi:', event.tag);
  
  if (event.tag === 'sync-database') {
    event.waitUntil(
      syncDatabase()
        .then(() => {
          console.log('Sinkronisasi database berhasil');
          // Kirim notifikasi ke semua klien
          return self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({ 
                type: 'SYNC_COMPLETE',
                message: 'Database berhasil disinkronisasi',
                timestamp: new Date().toISOString()
              });
            });
          });
        })
        .catch(error => {
          console.error('Gagal sinkronisasi:', error);
          // Coba lagi nanti
          return new Promise((resolve) => {
            setTimeout(() => {
              self.registration.sync.register('sync-database')
                .then(resolve)
                .catch(console.error);
            }, 5 * 60 * 1000); // Coba lagi dalam 5 menit
          });
        })
    );
  }
});

// Fungsi untuk sinkronisasi database
async function syncDatabase() {
  // Dapatkan semua klien yang terhubung
  const clients = await self.clients.matchAll();
  
  // Beri tahu klien bahwa sinkronisasi dimulai
  clients.forEach(client => {
    client.postMessage({ 
      type: 'SYNC_STARTED',
      timestamp: new Date().toISOString()
    });
  });
  
  try {
    // Di sini kita akan memproses antrian sinkronisasi
    // Implementasi sebenarnya akan memanggil API untuk menyinkronkan data
    // Ini adalah contoh sederhana
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return true;
  } catch (error) {
    console.error('Error saat sinkronisasi:', error);
    throw error;
  }
}

// Tangani pesan dari halaman web
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'TRIGGER_SYNC') {
    self.registration.sync.register('sync-database')
      .then(() => console.log('Sinkronisasi dipicu'))
      .catch(console.error);
  }
});

// Fetch Event - Strategi Cache First dengan fallback ke network
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);
  
  // Skip non-GET requests dan request yang bukan HTTP/HTTPS
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  // Handle API requests
  if (requestUrl.hostname === 'script.google.com' || 
      requestUrl.pathname.includes('/api/')) {
    event.respondWith(
      handleApiRequest(event)
    );
    return;
  }
  
  // Untuk aset statis, gunakan cache-first strategy
  if (PRECACHE_ASSETS.some(asset => requestUrl.pathname.endsWith(asset)) ||
      EXTERNAL_ASSETS.some(asset => request.url === asset)) {
    event.respondWith(
      caches.match(request)
        .then(response => {
          // Kembalikan dari cache jika ada
          if (response) {
            return response;
          }
          
          // Jika tidak ada di cache, ambil dari jaringan
          return fetch(request)
            .then(networkResponse => {
              // Simpan ke cache untuk penggunaan selanjutnya
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(request, responseToCache));
              return networkResponse;
            })
            .catch(() => {
              // Jika offline dan tidak ada di cache, tampilkan halaman offline
              if (request.mode === 'navigate') {
                return caches.match(OFFLINE_URL);
              }
              return new Response('Tidak dapat terhubung ke internet', {
                status: 503,
                statusText: 'Offline Mode',
                headers: new Headers({
                  'Content-Type': 'text/plain'
                })
              });
            });
        })
    );
    return;
  }
  
  // Untuk navigasi, gunakan network-first strategy
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Simpan respons ke cache
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE)
            .then(cache => cache.put(request, responseToCache));
          return response;
        })
        .catch(() => {
          // Jika offline, coba ambil dari cache
          return caches.match(request)
            .then(response => response || caches.match(OFFLINE_URL));
        })
    );
    return;
  }
  
  // Untuk request lainnya, coba dari jaringan dulu, lalu cache
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        // Jika ada di cache, kembalikan respons dari cache
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
