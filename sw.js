const STATIC_CACHE = 'wc26-static-v1';
const ODDS_CACHE   = 'wc26-odds-v1';
const AF_CACHE     = 'wc26-af-v1';

const PRECACHE_URLS = [
  '/WC2026_v104.html',
  '/manifest.json',
];

// ── 安裝：預快取靜態資源 ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  const keep = [STATIC_CACHE, ODDS_CACHE, AF_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !keep.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch 攔截 ────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // /api/odds → network-first，離線時回傳快取
  if (url.pathname.startsWith('/api/odds')) {
    event.respondWith(networkFirstCache(event.request, ODDS_CACHE));
    return;
  }

  // /api/af/* → network-first，離線時回傳快取
  if (url.pathname.startsWith('/api/af/')) {
    event.respondWith(networkFirstCache(event.request, AF_CACHE));
    return;
  }

  // Google Fonts → stale-while-revalidate
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(staleWhileRevalidate(event.request, STATIC_CACHE));
    return;
  }

  // 其餘（HTML、manifest）→ cache-first
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

// ── 策略函式 ─────────────────────────────────────────────────
async function networkFirstCache(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      // 在回應 header 加上離線標記，讓前端可以感知
      const headers = new Headers(cached.headers);
      headers.set('x-sw-offline', 'true');
      return new Response(cached.body, { status: cached.status, headers });
    }
    return new Response(JSON.stringify({ error: '離線且無快取資料' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'x-sw-offline': 'true' },
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  return cached || fetchPromise;
}
