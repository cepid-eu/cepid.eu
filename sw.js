/**
 * CEPID Infoviz Service Worker
 * Implements caching strategies for offline-first PWA
 * Supports dynamic cache busting via query parameters
 */

// Dynamic version from build or fallback
const VERSION = self.registration?.scope?.includes('v=')
  ? self.registration.scope.split('v=')[1].split('&')[0]
  : '1.0.0';
const CACHE_NAME = `cepid-infoviz-${VERSION}`;

// Maximum age for cache entries (24 hours)
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

// Track dynamic cache invalidations
let invalidatedUrls = new Set();

// Static assets to precache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/404.html',
  '/css/style.min.css',
  '/js/app.min.js',
  '/js/cache-buster.js',
  '/js/vendor/chart.min.js',
  '/js/vendor/d3.v7.min.js',
  '/assets/cepid-logo.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/favicon.ico',
  '/manifest.json'
];

// Data files that use stale-while-revalidate
const DATA_FILES = [
  '/data/aggregated.json',
  '/data/france-topo.json'
];

// CDN resources with network-first strategy
const CDN_PATTERNS = [
  /^https:\/\/d3js\.org/,
  /^https:\/\/cdn\.jsdelivr\.net/
];

/**
 * Install event - precache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing version:', VERSION);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Precaching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Precache failed:', error);
      })
  );
});

/**
 * Activate event - cleanup old caches and notify clients
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating version:', VERSION);

  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('cepid-infoviz-') && name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ]).then(() => {
      // Notify all clients of the update
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: VERSION
          });
        });
      });
    })
  );
});

/**
 * Utility: Normalize URL by removing cache-busting query parameters
 * Allows cache keys to be consistent regardless of ?v=xxx parameters
 */
function normalizeUrl(urlString) {
  try {
    const url = new URL(urlString, self.location.origin);
    // Remove cache-busting parameters but keep other query params
    url.searchParams.delete('v');
    url.searchParams.delete('cb');
    url.searchParams.delete('cache');
    // Sort remaining params for consistency
    const params = new URLSearchParams([...url.searchParams].sort());
    return url.origin + url.pathname + (params.toString() ? '?' + params.toString() : '') + url.hash;
  } catch (e) {
    return urlString;
  }
}

/**
 * Check if URL is in invalidated list
 */
function isInvalidatedUrl(urlString) {
  const normalized = normalizeUrl(urlString);
  return invalidatedUrls.has(normalized);
}

/**
 * Fetch event - implement caching strategies
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Determine caching strategy based on request type
  if (isDataFile(url)) {
    event.respondWith(staleWhileRevalidate(event.request));
  } else if (isCDNResource(url)) {
    event.respondWith(networkFirstWithFallback(event.request));
  } else if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(event.request));
  } else {
    // Default: network first for unknown requests
    event.respondWith(networkFirst(event.request));
  }
});

/**
 * Check if URL is a data file
 */
function isDataFile(url) {
  return DATA_FILES.some((file) => url.pathname.endsWith(file.replace(/^\//, '')));
}

/**
 * Check if URL is a CDN resource
 */
function isCDNResource(url) {
  return CDN_PATTERNS.some((pattern) => pattern.test(url.href));
}

/**
 * Check if URL is a static asset
 */
function isStaticAsset(url) {
  // Same origin and matches static asset patterns
  return url.origin === self.location.origin && (
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.json') && !isDataFile(url)
  );
}

/**
 * Cache-First Strategy
 * For static assets - serve from cache, fallback to network
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] Cache-first fetch failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Stale-While-Revalidate Strategy
 * For data files - serve cached, fetch fresh in background
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  // Fetch fresh version in background
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
      // Notify clients that data was updated
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'DATA_UPDATED',
            url: request.url
          });
        });
      });
    }
    return response;
  }).catch((error) => {
    console.log('[SW] Background fetch failed:', error);
    return null;
  });

  // Return cached immediately if available, otherwise wait for network
  if (cached) {
    return cached;
  }

  const response = await fetchPromise;
  if (response) {
    return response;
  }

  // No cache and no network
  return new Response(JSON.stringify({ error: 'Offline', offers: [] }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Network-First Strategy
 * For CDN resources - try network, fallback to local vendor copies
 */
async function networkFirstWithFallback(request) {
  const url = new URL(request.url);

  try {
    const response = await fetch(request, { timeout: 5000 });
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
      return response;
    }
    throw new Error('Network response not ok');
  } catch (error) {
    // Try cached CDN version first
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Fallback to local vendor copies
    if (url.href.includes('d3')) {
      return caches.match('/js/vendor/d3.v7.min.js');
    }
    if (url.href.includes('chart')) {
      return caches.match('/js/vendor/chart.min.js');
    }

    return new Response('Library unavailable', { status: 503 });
  }
}

/**
 * Network-First Strategy
 * For unknown requests - prefer network, fallback to cache
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Handle messages from clients
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: VERSION });
  }

  // Handle cache invalidation from CacheBuster module
  if (event.data && event.data.type === 'INVALIDATE_CACHE') {
    const urls = event.data.urls || [];
    urls.forEach(url => invalidatedUrls.add(normalizeUrl(url)));
    console.log('[SW] Cache invalidated for', urls.length, 'URLs');
  }

  // Handle precache requests from CacheBuster module
  if (event.data && event.data.type === 'PRECACHE_ASSETS') {
    const assets = event.data.assets || [];
    caches.open(CACHE_NAME).then(cache => {
      cache.addAll(assets).catch(err => {
        console.error('[SW] Precache failed:', err);
      });
    });
  }
});
