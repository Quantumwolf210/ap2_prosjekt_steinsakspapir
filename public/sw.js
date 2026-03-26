const CACHE = "ssp-v1";
const ASSETS = ["/", "/index.html", "/app.mjs", "/app.css", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // API: network-first
  if (req.url.includes("/api/")) {
    event.respondWith(fetch(req));
    return;
  }

  // Static: cache-first
  event.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
});