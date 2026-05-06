// ============================================================
// NICO Life Agent PWA — Service Worker
// Handles GitHub Pages subdirectory paths automatically
// ============================================================

const CACHE_VERSION = 'nico-agent-v1.1';

// Dynamically build cache list based on SW location (works for any subdirectory)
const BASE = self.location.pathname.replace('/sw.js', '/');

const PRECACHE_ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icons/icon-192x192.png',
  BASE + 'icons/icon-512x512.png',
  BASE + 'icons/apple-touch-icon.png',
];

const CDN_CACHE = 'nico-cdn-v1.1';
const CDN_PATTERNS = [
  'cdnjs.cloudflare.com/ajax/libs/html2canvas',
  'cdnjs.cloudflare.com/ajax/libs/jspdf',
  'fonts.gstatic.com',
  'fonts.googleapis.com',
];

// ============================================================
// INSTALL
// ============================================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => {
        console.warn('[SW] Pre-cache failed (offline?):', err);
        return self.skipWaiting();
      })
  );
});

// ============================================================
// ACTIVATE — delete old caches
// ============================================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION && k !== CDN_CACHE)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH
// ============================================================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and Google Sheets webhook calls (must be live)
  if (request.method !== 'GET') return;
  if (url.hostname.includes('script.google.com')) return;

  // CDN resources — cache first, long-lived
  if (CDN_PATTERNS.some(p => request.url.includes(p))) {
    event.respondWith(cdnCacheFirst(request));
    return;
  }

  // App shell — stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// ============================================================
// STRATEGIES
// ============================================================

// Cache first (CDN assets — rarely change)
async function cdnCacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CDN_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return offlineFallback();
  }
}

// Stale while revalidate (app files — serve instantly, update in background)
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);

  const networkFetch = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || await networkFetch || offlineFallback();
}

// Offline fallback page
async function offlineFallback() {
  const cached = await caches.match(BASE + 'index.html');
  return cached || new Response(
    `<!DOCTYPE html>
    <html>
      <head><meta charset="UTF-8"><title>NICO Life Agent</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:60px;background:#00AEEF;color:white">
        <h1 style="font-size:32px">NICO Life</h1>
        <p style="font-size:18px;margin-top:16px">You are offline.</p>
        <p style="opacity:.8">Please reconnect to use the Agent Portal.</p>
      </body>
    </html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}

// ============================================================
// BACKGROUND SYNC — retry failed Sheets syncs
// ============================================================
self.addEventListener('sync', event => {
  if (event.tag === 'sync-quotes') {
    event.waitUntil(
      self.clients.matchAll().then(clients =>
        clients.forEach(c => c.postMessage({ type: 'SYNC_REQUESTED' }))
      )
    );
  }
});

// ============================================================
// PUSH NOTIFICATIONS
// ============================================================
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'NICO Life Agent', {
      body:  data.body  || 'You have a new notification.',
      icon:  BASE + 'icons/icon-192x192.png',
      badge: BASE + 'icons/icon-96x96.png',
      data:  data.url   || BASE,
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data));
});
