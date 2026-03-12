const CACHE_NAME = 'bball-stats-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './game.html',
  './styles.css',
  './index.js',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
      caches.match(event.request).then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request).catch(() => {
            // Offline fallback if needed (handled by serving index.html essentially)
        });
      })
    );
});

// Clear old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    );
});
