/**
 * Router Module - SPA URL routing for GitHub Pages
 * Handles path-based navigation and query parameter state
 */

const Router = (function () {
  // Configuration
  const config = {
    basePath: '',
    defaultTab: 'overview',
    routes: {
      '/': 'overview',
      '/salaires': 'salaries',
      '/carte': 'map',
      '/secteurs': 'sectors',
      '/dossier': 'dossier'
    },
    tabToPath: {
      'overview': '/',
      'salaries': '/salaires',
      'map': '/carte',
      'sectors': '/secteurs',
      'dossier': '/dossier'
    },
    params: {
      jobFamilies: 'famille',
      contractTypes: 'contrat',
      departments: 'dept'
    }
  };

  let isInitialized = false;
  let isNavigating = false;

  /**
   * Initialize the router
   */
  function init() {
    if (isInitialized) return;

    detectBasePath();

    // Parse initial URL and restore state
    const state = parseCurrentURL();

    // Apply state after a short delay to ensure DOM is ready
    setTimeout(() => {
      applyState(state, false);
    }, 0);

    // Listen for browser back/forward
    window.addEventListener('popstate', handlePopState);

    // Listen for tab changes from UI
    window.addEventListener('tabChanged', handleTabChange);

    // Listen for filter changes
    window.addEventListener('dataFiltered', handleFilterChange);

    isInitialized = true;
    console.log('[Router] Initialized with basePath:', config.basePath);
  }

  /**
   * Detect base path from current URL
   */
  function detectBasePath() {
    const pathname = window.location.pathname;

    // Check for base tag
    const baseEl = document.querySelector('base');
    if (baseEl && baseEl.href) {
      const baseURL = new URL(baseEl.href);
      config.basePath = baseURL.pathname.replace(/\/$/, '');
      return;
    }

    // Detect GitHub Pages project subpath
    if (window.location.hostname.endsWith('.github.io')) {
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        const firstPart = '/' + parts[0];
        // Check if first segment is a known route
        if (!config.routes[firstPart]) {
          config.basePath = firstPart;
        }
      }
    }
  }

  /**
   * Parse current URL into state object
   */
  function parseCurrentURL() {
    let pathname = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    // Handle redirect from 404.html
    const redirectedRoute = params.get('__route');
    if (redirectedRoute) {
      params.delete('__route');
      const cleanSearch = params.toString();
      pathname = decodeURIComponent(redirectedRoute);

      // Build clean URL
      const cleanURL = config.basePath + pathname + (cleanSearch ? '?' + cleanSearch : '');
      history.replaceState(null, '', cleanURL);
    }

    // Remove base path
    let routePath = pathname;
    if (config.basePath && pathname.startsWith(config.basePath)) {
      routePath = pathname.slice(config.basePath.length) || '/';
    }

    // Normalize trailing slash
    routePath = routePath.replace(/\/$/, '') || '/';

    // Get tab from route
    const tab = config.routes[routePath] || config.defaultTab;

    // Parse query parameters
    const filters = {
      jobFamilies: parseArrayParam(params.get(config.params.jobFamilies)),
      contractTypes: parseArrayParam(params.get(config.params.contractTypes)),
      departments: parseArrayParam(params.get(config.params.departments))
    };

    return { tab, filters };
  }

  /**
   * Parse comma-separated array parameter
   */
  function parseArrayParam(value) {
    if (!value) return [];
    return value.split(',')
      .map(v => decodeURIComponent(v.trim()))
      .filter(Boolean);
  }

  /**
   * Encode array as comma-separated parameter
   */
  function encodeArrayParam(arr) {
    if (!arr || arr.length === 0) return null;
    return arr.map(v => encodeURIComponent(v)).join(',');
  }

  /**
   * Build URL from state
   */
  function buildURL(tab, filters) {
    const path = config.tabToPath[tab] || '/';
    const fullPath = config.basePath + path;

    // Build query string
    const params = new URLSearchParams();

    if (filters.jobFamilies?.length) {
      params.set(config.params.jobFamilies, encodeArrayParam(filters.jobFamilies));
    }
    if (filters.contractTypes?.length) {
      params.set(config.params.contractTypes, encodeArrayParam(filters.contractTypes));
    }
    if (filters.departments?.length) {
      params.set(config.params.departments, encodeArrayParam(filters.departments));
    }

    const queryString = params.toString();
    return fullPath + (queryString ? '?' + queryString : '');
  }

  /**
   * Navigate to a new state
   */
  function navigate(tab, filters = null, replace = false) {
    if (isNavigating) return;
    isNavigating = true;

    // Use current filters if not provided
    if (!filters && window.DataProcessor) {
      filters = DataProcessor.filters;
    }
    filters = filters || { jobFamilies: [], contractTypes: [], departments: [] };

    const url = buildURL(tab, filters);

    if (replace) {
      history.replaceState({ tab, filters }, '', url);
    } else {
      history.pushState({ tab, filters }, '', url);
    }

    isNavigating = false;
  }

  /**
   * Apply state to the application
   */
  function applyState(state, fromPopState = true) {
    if (isNavigating) return;
    isNavigating = true;

    // Apply tab
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${state.tab}"]`);
    if (tabBtn && !tabBtn.classList.contains('active')) {
      // Temporarily disable router updates
      tabBtn.click();
    }

    // Apply filters if they have values
    const hasFilters = state.filters.jobFamilies.length > 0 ||
      state.filters.contractTypes.length > 0 ||
      state.filters.departments.length > 0;

    if (hasFilters && window.DataProcessor) {
      DataProcessor.applyFilters(state.filters);
      syncFiltersToUI(state.filters);
    }

    isNavigating = false;
  }

  /**
   * Sync filter state to UI checkboxes
   */
  function syncFiltersToUI(filters) {
    // Job families - find checkboxes in filter-job-family container
    const jobFamilyContainer = document.getElementById('filter-job-family');
    if (jobFamilyContainer) {
      jobFamilyContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = filters.jobFamilies.includes(cb.value);
      });
    }

    // Contract types
    const contractContainer = document.getElementById('filter-contract');
    if (contractContainer) {
      contractContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = filters.contractTypes.includes(cb.value);
      });
    }

    // Update bottom sheet if it exists
    if (window.BottomSheet && BottomSheet.syncWithSidebar) {
      BottomSheet.syncWithSidebar();
    }
  }

  /**
   * Handle popstate (browser back/forward)
   */
  function handlePopState(event) {
    if (event.state) {
      applyState(event.state);
    } else {
      const state = parseCurrentURL();
      applyState(state);
    }
  }

  /**
   * Handle tab change from UI
   */
  function handleTabChange(event) {
    if (isNavigating) return;
    const tab = event.detail?.tab;
    if (tab) {
      navigate(tab, null, false);
    }
  }

  /**
   * Handle filter change
   */
  function handleFilterChange(event) {
    if (isNavigating) return;
    const filters = event.detail?.filters;
    const currentTab = window.App?.currentTab || 'overview';
    if (filters) {
      navigate(currentTab, filters, true);
    }
  }

  /**
   * Get shareable URL for current state
   */
  function getShareableURL() {
    const currentTab = window.App?.currentTab || 'overview';
    const filters = window.DataProcessor?.filters || { jobFamilies: [], contractTypes: [], departments: [] };
    return window.location.origin + buildURL(currentTab, filters);
  }

  /**
   * Set base path manually
   */
  function setBasePath(path) {
    config.basePath = path.replace(/\/$/, '');
  }

  /**
   * Get current route info
   */
  function getCurrentRoute() {
    return parseCurrentURL();
  }

  // Public API
  return {
    init,
    navigate,
    parseCurrentURL,
    buildURL,
    getShareableURL,
    setBasePath,
    getCurrentRoute
  };
})();

// Export
window.Router = Router;
