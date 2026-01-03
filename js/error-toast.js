/**
 * Error Toast Component
 * Displays friendly error messages in French with auto-dismiss
 * Follows "Oups, nous sommes désolés !" pattern
 */

const ErrorToast = (function() {
  let container = null;
  const defaultDuration = 5000; // 5 seconds

  /**
   * Predefined error messages in French
   */
  const messages = {
    network: "Une erreur réseau s'est produite. Veuillez vérifier votre connexion.",
    data: "Impossible de charger les données. Veuillez réessayer.",
    filter: "Erreur lors de l'application des filtres.",
    unknown: "Une erreur inattendue s'est produite."
  };

  /**
   * Initialize the error toast container
   */
  function init() {
    if (container) return; // Already initialized

    container = document.createElement('div');
    container.className = 'error-toast-container';
    container.setAttribute('role', 'alert');
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);

    console.log('[ErrorToast] Initialized');
  }

  /**
   * Show an error toast
   * @param {string} message - The error message to display
   * @param {number} duration - How long to show (ms), 0 for permanent
   * @returns {HTMLElement} The toast element
   */
  function show(message, duration = defaultDuration) {
    // Auto-initialize if needed
    if (!container) init();

    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.innerHTML = `
      <div class="error-toast-icon" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <div class="error-toast-content">
        <strong>Oups, nous sommes désolés !</strong>
        <p>${escapeHtml(message)}</p>
      </div>
      <button class="error-toast-close" aria-label="Fermer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    // Close button handler
    const closeBtn = toast.querySelector('.error-toast-close');
    closeBtn.addEventListener('click', () => dismiss(toast));

    container.appendChild(toast);

    // Trigger entrance animation
    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    // Auto-dismiss after duration (if not 0)
    if (duration > 0) {
      setTimeout(() => dismiss(toast), duration);
    }

    return toast;
  }

  /**
   * Dismiss a toast
   * @param {HTMLElement} toast - The toast element to dismiss
   */
  function dismiss(toast) {
    if (!toast || !toast.parentNode) return;

    toast.classList.remove('visible');
    toast.classList.add('dismissing');

    // Remove after animation completes
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }

  /**
   * Show a network error toast
   * @param {number} duration - Optional duration override
   */
  function showNetworkError(duration = 8000) {
    return show(messages.network, duration);
  }

  /**
   * Show a data loading error toast
   * @param {number} duration - Optional duration override
   */
  function showDataError(duration = 8000) {
    return show(messages.data, duration);
  }

  /**
   * Show a filter error toast
   * @param {number} duration - Optional duration override
   */
  function showFilterError(duration = 5000) {
    return show(messages.filter, duration);
  }

  /**
   * Show an unknown error toast
   * @param {number} duration - Optional duration override
   */
  function showUnknownError(duration = 5000) {
    return show(messages.unknown, duration);
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Public API
  return {
    init,
    show,
    dismiss,
    showNetworkError,
    showDataError,
    showFilterError,
    showUnknownError,
    messages
  };
})();

// Export for use in other modules
window.ErrorToast = ErrorToast;
