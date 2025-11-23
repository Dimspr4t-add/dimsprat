/* ===========================================================
   SERVICE WORKER: DIMSPRAT SCANNER OFFLINE
   =========================================================== */
const CACHE_NAME = 'dimsprat-scanner-v2'; // Ganti versi jika update kodingan
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './login.html',
  '../Assets/style.css', // Pastikan path ini sesuai struktur folder Anda
  '../Assets/js.css',
  '../Assets/images/logo.webp',
  '../Assets/images/favicon.ico',
  'https://unpkg.com/html5-qrcode', // Library Scanner
  'https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Orbitron:wght@500;700&display=swap'
];

// 1. INSTALL: Download semua aset penting
self.addEventListener('install', (e) => {
  console.log('[SW] Install');
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. ACTIVATE: Hapus cache lama jika ada update
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
  self.clients.claim();
});

// 3. FETCH: Strategi "Network First" untuk API, "Cache First" untuk Aset
self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // A. Jika request ke Google Apps Script (API)
  if (url.includes('script.google.com')) {
    e.respondWith(
      fetch(e.request)
        .catch(() => {
          // Jika offline saat fetch API, kembalikan JSON offline signal
          return new Response(JSON.stringify({ status: 'offline_mode' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
  } 
  // B. Jika request aset biasa (HTML, CSS, JS, Gambar)
  else {
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        // Pakai cache jika ada, jika tidak ada baru download
        return cachedResponse || fetch(e.request);
      })
    );
  }
});