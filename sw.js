/**
 * CEPID Infoviz Service Worker
 * Implements Workbox for robust PWA caching
 */
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.3/workbox-sw.js');

if (workbox) {
  console.log(`[SW] Workbox loaded`);

  const { registerRoute } = workbox.routing;
  const { CacheFirst, NetworkFirst, StaleWhileRevalidate, NetworkOnly } = workbox.strategies;
  const { CacheableResponsePlugin } = workbox.cacheableResponse;
  const { ExpirationPlugin } = workbox.expiration;
  const { BroadcastUpdatePlugin } = workbox.broadcastUpdate;

  // Cache Names
  const CACHE_EXT = 'cepid-external-v1';
  const CACHE_DATA = 'cepid-data-v1';
  const CACHE_ASSETS = 'cepid-assets-v1';
  const CACHE_PAGES = 'cepid-pages-v1';

  // 0. External Requests (AdSense, Sirdata CMP)
  // BYPASS: We do not route these through Workbox. 
  // This allows the browser to handle them natively (and handle AdBlock blocks natively).
  // No registerRoute here.

  // 1. Data Files (JSON) - StaleWhileRevalidate
  // Serve cached immediately, update in background, notify clients
  registerRoute(
    ({ url }) => url.pathname.endsWith('.json') && !url.pathname.includes('manifest'),
    new StaleWhileRevalidate({
      cacheName: CACHE_DATA,
      plugins: [
        new BroadcastUpdatePlugin(), // Notify window on update
        new ExpirationPlugin({
          maxEntries: 50,
        }),
      ],
    })
  );

  // 2. Static Assets (JS, CSS, Images, Fonts) - CacheFirst
  // These files are versioned via ?v=... in index.html, so cache them aggressively
  registerRoute(
    ({ request }) =>
      (request.destination === 'script' ||
        request.destination === 'style' ||
        request.destination === 'image' ||
        request.destination === 'font') &&
      !request.url.includes('googleads') &&
      !request.url.includes('googlesyndication') &&
      !request.url.includes('googletagservices') &&
      !request.url.includes('sirdata'),
    new CacheFirst({
      cacheName: CACHE_ASSETS,
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    })
  );

  // 3. CDN Resources (D3, Chart.js, Sentry) - CacheFirst
  // They are versioned URLs or stable libs
  registerRoute(
    ({ url }) => url.href.includes('d3js.org') ||
      url.href.includes('jsdelivr.net') ||
      url.href.includes('sentry-cdn.com') ||
      url.href.includes('googleapis.com') ||
      url.href.includes('gstatic.com'),
    new CacheFirst({
      cacheName: CACHE_EXT,
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new ExpirationPlugin({
          maxEntries: 30,
        }),
      ],
    })
  );

  // 4. HTML Pages - NetworkFirst
  // Always try to get fresh index.html. Fallback to cache if offline.
  registerRoute(
    ({ request }) => request.mode === 'navigate',
    new NetworkFirst({
      cacheName: CACHE_PAGES,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 10,
        }),
      ],
    })
  );

  // Force update logic (handling skipWaiting)
  self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
    // Backward compatibility with previous SW logic if any
    if (event.data && event.data.type === 'GET_VERSION') {
      event.ports[0].postMessage({ version: 'workbox-v1' });
    }
  });

} else {
  console.log(`[SW] Workbox failed to load`);
}
