/**
 * Swipe Navigation Component
 * Enables swipe left/right gestures to navigate between tabs on mobile
 */

const SwipeNavigation = (function() {
  const SWIPE_THRESHOLD = 50; // Minimum distance for a swipe
  const SWIPE_VELOCITY_THRESHOLD = 0.3; // Minimum velocity for a swipe
  const MAX_VERTICAL_RATIO = 0.75; // Max ratio of vertical to horizontal movement

  let contentArea = null;
  let tabButtons = null;
  let currentTabIndex = 0;

  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let isTracking = false;
  let isSwiping = false;

  // Tab order
  const TAB_ORDER = ['overview', 'salaries', 'map', 'sectors', 'dossier'];

  /**
   * Initialize the component
   */
  function init() {
    contentArea = document.querySelector('.content-area');
    tabButtons = document.querySelectorAll('.tab-btn');

    if (!contentArea) {
      console.warn('[SwipeNavigation] Content area not found');
      return;
    }

    // Get initial tab index
    updateCurrentTabIndex();

    // Touch event listeners
    contentArea.addEventListener('touchstart', handleTouchStart, { passive: true });
    contentArea.addEventListener('touchmove', handleTouchMove, { passive: false });
    contentArea.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Listen for tab changes (from button clicks)
    tabButtons.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        currentTabIndex = index;
      });
    });

    console.log('[SwipeNavigation] Initialized');
  }

  /**
   * Update current tab index from active tab
   */
  function updateCurrentTabIndex() {
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) {
      const tabName = activeTab.dataset.tab;
      currentTabIndex = TAB_ORDER.indexOf(tabName);
      if (currentTabIndex === -1) currentTabIndex = 0;
    }
  }

  /**
   * Handle touch start
   */
  function handleTouchStart(e) {
    // Don't track if bottom sheet is open
    if (window.BottomSheet && BottomSheet.isOpen()) return;

    // Don't track if touching an interactive element
    const target = e.target;
    if (isInteractiveElement(target)) return;

    // Don't track if touching a chart or map (allow panning)
    if (isChartOrMap(target)) return;

    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
    isTracking = true;
    isSwiping = false;
  }

  /**
   * Handle touch move
   */
  function handleTouchMove(e) {
    if (!isTracking) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - startX;
    const deltaY = currentY - startY;

    // Check if this is a horizontal swipe
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // If moving more vertically, stop tracking
    if (absY > absX * MAX_VERTICAL_RATIO && absY > 10) {
      isTracking = false;
      return;
    }

    // Check if we're in a horizontally scrollable table
    if (isInHorizontallyScrollableTable(e.target)) {
      isTracking = false;
      return;
    }

    // If moving horizontally enough, this is a swipe
    if (absX > 10) {
      isSwiping = true;
      // Prevent vertical scroll while swiping horizontally
      e.preventDefault();
    }
  }

  /**
   * Handle touch end
   */
  function handleTouchEnd(e) {
    if (!isTracking || !isSwiping) {
      isTracking = false;
      return;
    }

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const endTime = Date.now();

    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const deltaTime = endTime - startTime;

    // Calculate velocity
    const velocity = Math.abs(deltaX) / deltaTime;

    // Check if swipe is valid
    const isValidSwipe = (
      Math.abs(deltaX) > SWIPE_THRESHOLD &&
      velocity > SWIPE_VELOCITY_THRESHOLD &&
      Math.abs(deltaY) < Math.abs(deltaX) * MAX_VERTICAL_RATIO
    );

    if (isValidSwipe) {
      if (deltaX < 0) {
        // Swipe left - next tab
        navigateToNextTab();
      } else {
        // Swipe right - previous tab
        navigateToPreviousTab();
      }
    }

    isTracking = false;
    isSwiping = false;
  }

  /**
   * Check if element is interactive
   */
  function isInteractiveElement(element) {
    const interactiveTags = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'];
    const interactiveRoles = ['button', 'link', 'checkbox', 'radio', 'slider'];

    let current = element;
    while (current && current !== contentArea) {
      // Check tag name
      if (interactiveTags.includes(current.tagName)) return true;

      // Check role
      const role = current.getAttribute('role');
      if (role && interactiveRoles.includes(role)) return true;

      // Check if it's a clickable element
      if (current.onclick || current.hasAttribute('data-clickable')) return true;

      current = current.parentElement;
    }

    return false;
  }

  /**
   * Check if element is in a horizontally scrollable table
   */
  function isInHorizontallyScrollableTable(element) {
    let current = element;
    while (current && current !== contentArea) {
      // Check for salary-table-container or other horizontal scroll containers
      if (current.classList && (current.classList.contains('salary-table-container') || current.classList.contains('horizontal-scroll-container'))) {
        // Verify it actually has horizontal scroll capability
        if (current.scrollWidth > current.clientWidth) {
          return true;
        }
      }

      // Check for table element
      if (current.tagName === 'TABLE') {
        const container = current.parentElement;
        if (container && container.scrollWidth > container.clientWidth) {
          return true;
        }
      }

      current = current.parentElement;
    }

    return false;
  }

  /**
   * Check if element is a chart or map
   */
  function isChartOrMap(element) {
    let current = element;
    while (current && current !== contentArea) {
      // Check for chart canvas
      if (current.tagName === 'CANVAS') return true;

      // Check for SVG (D3 charts/maps)
      if (current.tagName === 'SVG' || current.tagName === 'svg') return true;

      // Check for map container
      if (current.id === 'france-map' || current.id === 'sector-treemap') return true;

      // Check for chart card (allow swiping from empty areas)
      if (current.classList.contains('chart-card')) {
        // Only block if directly touching chart content
        return false;
      }

      current = current.parentElement;
    }

    return false;
  }

  /**
   * Navigate to the next tab
   */
  function navigateToNextTab() {
    if (currentTabIndex < TAB_ORDER.length - 1) {
      currentTabIndex++;
      activateTab(TAB_ORDER[currentTabIndex]);
    }
  }

  /**
   * Navigate to the previous tab
   */
  function navigateToPreviousTab() {
    if (currentTabIndex > 0) {
      currentTabIndex--;
      activateTab(TAB_ORDER[currentTabIndex]);
    }
  }

  /**
   * Activate a tab
   */
  function activateTab(tabName) {
    // Find and click the tab button
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (tabBtn) {
      tabBtn.click();

      // Scroll tab into view
      tabBtn.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }

  /**
   * Get current tab name
   */
  function getCurrentTab() {
    return TAB_ORDER[currentTabIndex];
  }

  /**
   * Set current tab (for external sync)
   */
  function setCurrentTab(tabName) {
    const index = TAB_ORDER.indexOf(tabName);
    if (index !== -1) {
      currentTabIndex = index;
    }
  }

  // Public API
  return {
    init,
    getCurrentTab,
    setCurrentTab,
    navigateToNextTab,
    navigateToPreviousTab
  };
})();

// Export for use in other modules
window.SwipeNavigation = SwipeNavigation;
