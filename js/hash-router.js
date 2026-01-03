/**
 * Hash-Based Router Module
 * Provides hash-based URI routing (#/path) alongside path-based routing
 * Ensures backward compatibility with existing path-based routes
 * Supports automatic redirection between formats
 */

const HashRouter = (function() {
  const ENABLE_HASH_ROUTING = true;
  const ENABLE_PATH_TO_HASH_REDIRECT = false; // Set to true to force hash-based URLs
  const ENABLE_HASH_TO_PATH_REDIRECT = false; // Set to true to force path-based URLs

  let currentPath = '/';
  let currentParams = {};
  let listeners = [];

  /**
   * Initialize hash router
   */
  function init() {
    if (!ENABLE_HASH_ROUTING) {
      console.log('[HashRouter] Hash routing disabled');
      return;
    }

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);

    // Parse initial hash
    parseCurrentHash();

    // Dispatch initial navigation event
    dispatchRouteChanged();

    console.log('[HashRouter] Initialized');
  }

  /**
   * Parse current hash and extract path + params
   */
  function parseCurrentHash() {
    const hash = window.location.hash;

    if (!hash || hash === '#' || hash === '#/') {
      currentPath = '/';
      currentParams = {};
      return;
    }

    // Remove '#' prefix
    let hashContent = hash.substring(1);

    // Split path from query string
    const [pathPart, queryPart] = hashContent.split('?');
    currentPath = pathPart || '/';

    // Parse query parameters
    if (queryPart) {
      currentParams = Object.fromEntries(new URLSearchParams(queryPart));
    } else {
      currentParams = {};
    }
  }

  /**
   * Handle hash change event
   */
  function handleHashChange() {
    parseCurrentHash();
    dispatchRouteChanged();
  }

  /**
   * Navigate to a path using hash URI
   * @param {string} path - Path to navigate to (e.g., "/salaires")
   * @param {object} params - Optional query parameters
   */
  function navigateTo(path, params = {}) {
    let uri = path;
    if (!path.startsWith('/')) uri = '/' + path;

    // Build hash URI with parameters
    let hashUri = '#' + uri;
    if (Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(params).toString();
      hashUri += '?' + queryString;
    }

    // Update location
    window.location.hash = hashUri;

    // Parse and dispatch immediately (hashchange might be debounced)
    parseCurrentHash();
    dispatchRouteChanged();
  }

  /**
   * Get current path
   */
  function getPath() {
    return currentPath;
  }

  /**
   * Get current parameters
   */
  function getParams() {
    return { ...currentParams };
  }

  /**
   * Get parameter value
   */
  function getParam(key, defaultValue = null) {
    return currentParams[key] ?? defaultValue;
  }

  /**
   * Set parameter and navigate
   */
  function setParam(key, value) {
    const newParams = { ...currentParams, [key]: value };
    navigateTo(currentPath, newParams);
  }

  /**
   * Remove parameter and navigate
   */
  function removeParam(key) {
    const newParams = { ...currentParams };
    delete newParams[key];
    navigateTo(currentPath, newParams);
  }

  /**
   * Check if current path matches
   */
  function isPath(testPath) {
    return currentPath === testPath;
  }

  /**
   * Check if current path starts with
   */
  function isPathLike(testPath) {
    return currentPath.startsWith(testPath);
  }

  /**
   * Subscribe to route changes
   */
  function onRouteChanged(callback) {
    listeners.push(callback);
    return () => {
      listeners = listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Dispatch route changed event
   */
  function dispatchRouteChanged() {
    listeners.forEach(callback => {
      try {
        callback({
          path: currentPath,
          params: currentParams,
          hash: window.location.hash
        });
      } catch (error) {
        console.error('[HashRouter] Callback error:', error);
      }
    });

    // Also dispatch global event for other modules
    window.dispatchEvent(new CustomEvent('hashRouteChanged', {
      detail: { path: currentPath, params: currentParams }
    }));
  }

  /**
   * Handle path-based routing from existing router
   * Redirects path-based routes to hash-based if enabled
   */
  function handlePathRoute(path, params = {}) {
    if (ENABLE_PATH_TO_HASH_REDIRECT && !path.includes('#')) {
      console.log('[HashRouter] Redirecting path to hash:', path);
      navigateTo(path, params);
      return false; // Prevent default path routing
    }
    return true; // Allow path routing
  }

  /**
   * Get current state as shareable URL
   */
  function getShareableUrl() {
    const baseUrl = window.location.origin + window.location.pathname;
    const hash = window.location.hash;
    return baseUrl + hash;
  }

  /**
   * Restore state from URL hash
   */
  function restoreStateFromUrl() {
    parseCurrentHash();
    return {
      path: currentPath,
      params: currentParams
    };
  }

  /**
   * Replace hash without adding to history
   * Useful for silent state updates
   */
  function replaceState(path, params = {}) {
    let uri = path;
    if (!path.startsWith('/')) uri = '/' + path;

    let hashUri = '#' + uri;
    if (Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(params).toString();
      hashUri += '?' + queryString;
    }

    // Use replaceState to avoid history entry
    window.history.replaceState(null, '', window.location.pathname + hashUri);

    // Parse and dispatch
    parseCurrentHash();
    dispatchRouteChanged();
  }

  // Public API
  return {
    init,
    navigateTo,
    getPath,
    getParams,
    getParam,
    setParam,
    removeParam,
    isPath,
    isPathLike,
    onRouteChanged,
    getShareableUrl,
    restoreStateFromUrl,
    replaceState,
    handlePathRoute
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', HashRouter.init);
} else {
  HashRouter.init();
}

// Export for use in other modules
window.HashRouter = HashRouter;
