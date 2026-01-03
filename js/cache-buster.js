/**
 * Cache Buster Module
 * Manages cache invalidation via query parameters and hash-based URIs
 * Ensures fresh asset delivery through PWA-aware versioning strategy
 */

const CacheBuster = (function () {
  // Build version from HTML meta tag or current timestamp
  let buildVersion = null;
  let isOffline = false;

  /**
   * Initialize cache buster
   */
  function init() {
    // Get build version from meta tag or use current timestamp
    const versionMeta = document.querySelector('meta[name="build-version"]');
    buildVersion = versionMeta ? versionMeta.content : generateTimestampVersion();

    // Check if URL has a different version in query parameter
    checkURLVersion();

    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    isOffline = !navigator.onLine;

    console.log('[CacheBuster] Initialized with version:', buildVersion);
  }

  /**
   * Check if URL query parameter contains a different version
   * If yes, trigger update toast to notify user
   */
  function checkURLVersion() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlVersion = urlParams.get('v') || urlParams.get('build');

    if (urlVersion && urlVersion !== buildVersion) {
      console.log('[CacheBuster] Version mismatch detected!');
      console.log('  Current:', buildVersion);
      console.log('  URL:', urlVersion);

      // Store the new version for later
      sessionStorage.setItem('pendingVersion', urlVersion);

      // Trigger update notification as soon as UpdateToast is available
      triggerUpdateToast(urlVersion);
    }
  }

  /**
   * Trigger update toast when UpdateToast module is available
   * Uses polling to avoid arbitrary timeouts
   */
  function triggerUpdateToast(urlVersion) {
    // Check if UpdateToast is already available
    if (window.UpdateToast) {
      console.log('[CacheBuster] Triggering update toast for new version');
      window.dispatchEvent(new CustomEvent('swUpdated', {
        detail: {
          version: urlVersion,
          source: 'url-parameter',
          currentVersion: buildVersion
        }
      }));
      return;
    }

    // Poll for UpdateToast availability (check every 50ms, max 10 seconds)
    let attempts = 0;
    const maxAttempts = 200; // 50ms * 200 = 10 seconds max
    const pollInterval = setInterval(() => {
      attempts++;

      if (window.UpdateToast) {
        clearInterval(pollInterval);
        console.log('[CacheBuster] UpdateToast available, triggering update notification');
        window.dispatchEvent(new CustomEvent('swUpdated', {
          detail: {
            version: urlVersion,
            source: 'url-parameter',
            currentVersion: buildVersion
          }
        }));
      } else if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        console.warn('[CacheBuster] UpdateToast not available after 10 seconds');
      }
    }, 50);
  }

  /**
   * Generate version from current timestamp (fallback)
   */
  function generateTimestampVersion() {
    return Math.floor(Date.now() / 1000).toString(36);
  }

  /**
   * Get current build version
   */
  function getVersion() {
    return buildVersion || generateTimestampVersion();
  }

  /**
   * Add cache-busting query parameter to URL
   * @param {string} url - Base URL
   * @param {boolean} force - Force new parameter even if one exists
   * @returns {string} - URL with cache-buster query parameter
   */
  function addCacheBuster(url, force = false) {
    if (!url) return url;

    // Parse URL to separate base and existing params
    const urlObj = new URL(url, window.location.origin);
    const hasExistingBuster = urlObj.searchParams.has('v') || urlObj.searchParams.has('cb');

    // Only add if not present or if force is true
    if (!hasExistingBuster || force) {
      urlObj.searchParams.set('v', getVersion());
    }

    return urlObj.toString();
  }

  /**
   * Convert path to hash-based URI
   * @param {string} path - Path to convert (e.g., "/salaires")
   * @returns {string} - Hash-based URI (e.g., "#/salaires")
   */
  function toHashURI(path) {
    if (!path) return '#/';
    if (path.startsWith('#')) return path;
    if (!path.startsWith('/')) path = '/' + path;
    return '#' + path;
  }

  /**
   * Convert hash-based URI to path
   * @param {string} hashURI - Hash URI (e.g., "#/salaires")
   * @returns {string} - Path (e.g., "/salaires")
   */
  function fromHashURI(hashURI) {
    if (!hashURI) return '/';
    if (!hashURI.startsWith('#')) return hashURI;
    const path = hashURI.substring(1);
    return path || '/';
  }

  /**
   * Get current hash-based URI
   */
  function getCurrentHashURI() {
    return window.location.hash || '#/';
  }

  /**
   * Navigate to hash-based URI
   * @param {string} path - Path to navigate to
   * @param {object} params - Optional query parameters
   */
  function navigateToHash(path, params = {}) {
    let uri = toHashURI(path);

    // Add query parameters if provided
    if (Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(params).toString();
      uri += (path.includes('?') ? '&' : '?') + queryString;
    }

    // Use history API for smooth navigation
    window.location.hash = uri;

    // Dispatch custom event for hash change
    window.dispatchEvent(new CustomEvent('hashNavigated', {
      detail: { path, params, uri }
    }));
  }

  /**
   * Get query parameters from current hash URI
   */
  function getHashParams() {
    const hash = window.location.hash;
    if (!hash.includes('?')) return {};

    const queryString = hash.split('?')[1];
    return Object.fromEntries(new URLSearchParams(queryString));
  }

  /**
   * Check if path-based URL should redirect to hash-based
   * Useful for backward compatibility
   */
  function shouldRedirectToHash(path) {
    // Config: set to true to enable path->hash redirects
    const ENABLE_PATH_TO_HASH_REDIRECT = false;
    return ENABLE_PATH_TO_HASH_REDIRECT && !path.startsWith('#') && path !== '/';
  }

  /**
   * Get cache invalidation strategy based on device state
   * @returns {string} - Strategy name: 'aggressive', 'normal', or 'conservative'
   */
  function getCacheStrategy() {
    if (isOffline) {
      return 'conservative'; // Rely on cache when offline
    }

    // Check if user has explicitly asked for refresh
    if (sessionStorage.getItem('forceRefresh')) {
      sessionStorage.removeItem('forceRefresh');
      return 'aggressive'; // Bypass cache, fetch from network
    }

    return 'normal'; // Default: cache-first with network fallback
  }

  /**
   * Handle online event
   */
  function handleOnline() {
    isOffline = false;
    console.log('[CacheBuster] Device is online');

    // Dispatch event for other modules
    window.dispatchEvent(new CustomEvent('cacheOnline'));
  }

  /**
   * Handle offline event
   */
  function handleOffline() {
    isOffline = true;
    console.log('[CacheBuster] Device is offline');

    // Dispatch event for other modules
    window.dispatchEvent(new CustomEvent('cacheOffline'));
  }

  /**
   * Force cache invalidation (next fetch will bypass cache)
   */
  function forceRefresh() {
    sessionStorage.setItem('forceRefresh', 'true');
  }

  /**
   * Pre-cache critical assets
   * Called during service worker registration
   */
  async function preCacheAssets(assets) {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
      return;
    }

    navigator.serviceWorker.controller.postMessage({
      type: 'PRECACHE_ASSETS',
      assets: assets.map(url => addCacheBuster(url))
    });
  }

  /**
   * Invalidate specific cache entries
   * Called when need to bust cache for specific URLs
   */
  async function invalidateCache(urls) {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
      return;
    }

    navigator.serviceWorker.controller.postMessage({
      type: 'INVALIDATE_CACHE',
      urls: Array.isArray(urls) ? urls : [urls]
    });
  }

  // Public API
  return {
    init,
    getVersion,
    addCacheBuster,
    toHashURI,
    fromHashURI,
    getCurrentHashURI,
    navigateToHash,
    getHashParams,
    shouldRedirectToHash,
    getCacheStrategy,
    forceRefresh,
    preCacheAssets,
    invalidateCache
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', CacheBuster.init);
} else {
  CacheBuster.init();
}

// Export for use in other modules
window.CacheBuster = CacheBuster;
