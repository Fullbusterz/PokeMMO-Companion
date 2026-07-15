// Service worker for the PokeMMO Companion PWA (static export served under /PokeMMO-Companion/).
//
// Strategy (intentionally simple, no build step / no Workbox):
// - Versioned cache name -> bump CACHE_VERSION whenever the caching strategy itself changes,
//   so old caches from previous versions of this file get cleaned up on activate.
// - Minimal app-shell precache on install (paths that always exist and rarely change).
// - Cache-first for hashed, content-addressed assets under /_expo/ (safe to cache forever,
//   a new build always ships a new hashed filename).
// - Network-first with cache fallback for page navigations (so the app still opens offline
//   after the first successful visit, but always prefers a fresh copy when online).
// - skipWaiting + clients.claim so a new deploy takes over immediately instead of waiting
//   for every open tab to be closed first.

const CACHE_VERSION = 'v1';
const CACHE_NAME = `pokemmo-companion-${CACHE_VERSION}`;
const BASE = '/PokeMMO-Companion/';

const SHELL_ASSETS = [
  BASE,
  `${BASE}index.html`,
  `${BASE}manifest.json`,
  `${BASE}favicon.ico`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => {
        // Never fail install because of a single missing shell asset (e.g. no favicon yet).
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle simple same-origin GET requests; let everything else (POST, cross-origin,
  // chrome-extension://, etc.) go straight to the network untouched.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first for hashed Expo static output (JS/CSS/fonts under /_expo/) — the filename
  // itself changes whenever the content changes, so a cached copy is always valid.
  if (url.pathname.includes('/_expo/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // Network-first (falling back to cache, then the cached shell) for navigations — this is
  // a single-page app, so any unknown path should resolve back to the app shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(
          () =>
            caches.match(request).then((cached) => cached) ||
            caches.match(`${BASE}index.html`)
        )
    );
    return;
  }

  // Everything else same-origin (manifest, icons, misc assets): network-first, cache fallback.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
