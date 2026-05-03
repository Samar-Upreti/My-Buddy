const CACHE_NAME = 'my-buddy-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/main.css',
  '/dist/bundle.js',
  '/manifest.json'
];

// Install event - caching assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Fetch event - serving from cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});