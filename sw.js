const CACHE_NAME = "omniwallet-cache-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css?v=1.0",
  "./js/store.js?v=1.0",
  "./js/ai.js?v=1.0",
  "./js/supabase.js?v=1.0",
  "./js/app.js?v=1.0",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./favicon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
