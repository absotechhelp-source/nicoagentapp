// ============================================================
// NICO Life Agent PWA — Service Worker v1.2
// Compatible with GitHub Pages subdirectory hosting
// ============================================================

const CACHE_VERSION = 'nico-agent-v1.2';
const CDN_CACHE     = 'nico-cdn-v1.2';

// Resolve BASE path dynamically — works whether hosted at root or /repo-name/
const BASE = self.registration.scope;

const PRECACHE = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icons/icon-192x192.png',
  BASE + 'icons/icon-512x512.png',
  BASE + 'icons/apple-touch-icon.png',
];

const CDN_HOSTS = [
  'cdnjs.cloudflare.com',
  'fonts.gstatic.com',
  'fonts.googleapis.com',
];

// ============================================================
// INSTALL — pre-cache shell
// ============================================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => {
        // addAll fails if any request fails — use individual puts instead
        return Promise.allSettled(
          PRECACHE.map(url =>
            fetch(url).then(res => {
              if (res.ok) return cache.put(url, res);
            }).catch(() => {/* ignore offline errors on install */})
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ============================================================
// ACTIVATE — purge old caches, take control immediately
// ============================================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION && k !== CDN_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())   // ← Critical: take control of open tabs now
  );
});

// ============================================================
// FETCH — serve app
// ============================================================
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET
  if (req.method !== 'GET') return;

  // Never intercept Google Sheets webhook
  if (url.hostname.includes('script.google.com')) return;

  // CDN assets → cache-first (long-lived, never changes)
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(req, CDN_CACHE));
    return;
  }

  // App files → stale-while-revalidate (fast + stays fresh)
  event.respondWith(staleWhileRevalidate(req));
});

// ============================================================
// CACHE STRATEGIES
// ============================================================
async function cacheFirst(request, cacheName = CACHE_VERSION) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return offlinePage();
  }
}

async function staleWhileRevalidate(request) {
  const cache  = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);

  // Kick off network fetch in background
  const networkPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  // Return cached instantly if available, else wait for network
  return cached ?? await networkPromise ?? offlinePage();
}

async function offlinePage() {
  // Try to serve the cached app shell
  const cached = await caches.match(BASE + 'index.html')
               || await caches.match(BASE);
  if (cached) return cached;

  return new Response(
    `<!DOCTYPE html><html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>NICO Life Agent — Offline</title></head>
    <body style="margin:0;font-family:sans-serif;background:#00AEEF;color:#fff;
                 display:flex;flex-direction:column;align-items:center;
                 justify-content:center;height:100vh;text-align:center;padding:24px">
      <div style="font-size:56px;margin-bottom:16px">📵</div>
      <h1 style="font-size:28px;margin:0 0 8px">NICO Life Agent</h1>
      <p style="font-size:16px;opacity:.85;margin:0 0 24px">You're offline. Please reconnect to continue.</p>
      <button onclick="location.reload()" style="padding:12px 28px;border-radius:24px;
              border:2px solid white;background:transparent;color:white;
              font-size:15px;font-weight:700;cursor:pointer">Try Again</button>
    </body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  );
}

// ============================================================
// BACKGROUND SYNC
// ============================================================
self.addEventListener('sync', event => {
  if (event.tag === 'sync-quotes') {
    event.waitUntil(
      self.clients.matchAll()
        .then(clients => clients.forEach(c => c.postMessage({ type: 'SYNC_REQUESTED' })))
    );
  }
});
