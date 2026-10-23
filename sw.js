// Offline support: app files and the food database are cached; Open Food Facts always goes to the network.
const CACHE = "mt-v4";
const SHELL = [
  "./", "index.html", "css/app.css", "js/nutrients.js", "js/foods.js", "js/off.js", "js/scanner.js", "js/app.js",
  "data/foods.json?v=2", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "no-cache" }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // the food database is large and versioned by its URL: cache first
  if (url.pathname.endsWith("/data/foods.json")) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    })));
    return;
  }

  // everything else: network first so updates arrive, cache when offline.
  // "no-cache" asks GitHub Pages whether the file changed instead of using the browser's 10-minute copy.
  e.respondWith(
    fetch(req, { cache: "no-cache" }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: req.mode === "navigate" }).then(hit => hit || caches.match("index.html")))
  );
});
