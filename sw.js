const STATIC_CACHE_NAME = "my-buddy-static-v2";
const PAGE_CACHE_NAME = "my-buddy-pages-v2";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/main.css",
  "/dist/bundle.js",
  "/manifest.json",
  "/sw.js",
  "/assets/img/icon-192.png",
  "/assets/img/icon-512.png",
  "/assets/img/logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => ![STATIC_CACHE_NAME, PAGE_CACHE_NAME].includes(cacheName))
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(handleStaticAssetRequest(request));
});

async function handleNavigationRequest(request) {
  const pageCache = await caches.open(PAGE_CACHE_NAME);

  try {
    const networkResponse = await fetch(request);
    pageCache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    const cachedPage = await pageCache.match(request);

    if (cachedPage) {
      return cachedPage;
    }

    return caches.match("/index.html");
  }
}

async function handleStaticAssetRequest(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetch(request);

  if (networkResponse.ok) {
    const staticCache = await caches.open(STATIC_CACHE_NAME);
    staticCache.put(request, networkResponse.clone());
  }

  return networkResponse;
}
