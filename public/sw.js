// Articulate AI service worker: app-shell caching so practice works offline (with on-device estimates).
const VERSION = "aai-v2";
const SHELL = ["/", "/practice?d=5", "/progress", "/coach", "/settings", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (e) => {
  // Cache each shell page individually, skipping redirects (e.g. to the access-code screen):
  // Safari refuses to serve a redirected response for a navigation.
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.all(SHELL.map((u) => fetch(u).then((res) => (res.ok && !res.redirected ? c.put(u, res) : null)).catch(() => null))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never cache AI / private data

  // Immutable build assets: cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })));
    return;
  }
  // Pages: network-first, fall back to cache (ignoring query string), then the home shell.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => { if (res.ok && res.type === "basic" && !res.redirected) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })
        .catch(async () => (await caches.match(req)) || (await caches.match(req, { ignoreSearch: true })) || (await caches.match("/practice?d=5")) || caches.match("/")),
    );
  }
});
