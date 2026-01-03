/**
 * Update Toast Component
 * Shows notification when a new version is available
 * with countdown and auto-reload
 */

const UpdateToast = (function() {
  const COUNTDOWN_SECONDS = 5;

  let toastEl = null;
  let countdownEl = null;
  let reloadBtn = null;
  let dismissBtn = null;
  let countdownInterval = null;
  let remainingSeconds = COUNTDOWN_SECONDS;

  /**
   * Initialize the component
   */
  function init() {
    toastEl = document.getElementById('update-toast');
    countdownEl = document.getElementById('update-countdown');
    reloadBtn = document.getElementById('update-reload');
    dismissBtn = document.getElementById('update-dismiss');

    if (!toastEl) {
      console.warn('[UpdateToast] Toast element not found');
      return;
    }

    // Event listeners
    reloadBtn?.addEventListener('click', () => {
      reload();
    });

    dismissBtn?.addEventListener('click', () => {
      dismiss();
    });

    // Listen for SW update event
    window.addEventListener('swUpdated', (event) => {
      console.log('[UpdateToast] Service Worker updated', event.detail);
      show();
    });

    console.log('[UpdateToast] Initialized');
  }

  /**
   * Show the toast with countdown
   */
  function show() {
    if (!toastEl) return;

    toastEl.hidden = false;
    toastEl.classList.add('visible');
    remainingSeconds = COUNTDOWN_SECONDS;
    updateCountdownText();

    // Start countdown
    countdownInterval = setInterval(() => {
      remainingSeconds--;
      updateCountdownText();

      if (remainingSeconds <= 0) {
        reload();
      }
    }, 1000);
  }

  /**
   * Update the countdown text
   */
  function updateCountdownText() {
    if (countdownEl) {
      countdownEl.textContent = `Rechargement dans ${remainingSeconds}s...`;
    }
  }

  /**
   * Dismiss the toast
   */
  function dismiss() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    if (toastEl) {
      toastEl.classList.remove('visible');
      setTimeout(() => {
        toastEl.hidden = true;
      }, 300);
    }
  }

  /**
   * Reload the page
   */
  function reload() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    // Force reload, bypassing cache
    window.location.reload();
  }

  /**
   * Check if toast is visible
   */
  function isVisible() {
    return toastEl && !toastEl.hidden;
  }

  // Public API
  return {
    init,
    show,
    dismiss,
    reload,
    isVisible
  };
})();

// Export for use in other modules
window.UpdateToast = UpdateToast;
