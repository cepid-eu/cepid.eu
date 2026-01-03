/**
 * Bottom Sheet Component
 * Mobile-friendly filter panel that slides up from the bottom
 * Google Maps style interaction
 */

const BottomSheet = (function () {
  let sheetEl = null;
  let overlayEl = null;
  let contentEl = null;
  let closeBtn = null;
  let resetBtn = null;
  let applyBtn = null;
  let filterBtn = null;
  let filterBadge = null;

  let isOpen = false;
  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  // Department data for search (DS-1: Share Data Source)
  let departments = {};

  // Pending filter state (not applied until user clicks Apply)
  let pendingFilters = {
    jobFamilies: [],
    contractTypes: [],
    departments: []
  };

  /**
   * Initialize the component
   */
  function init() {
    sheetEl = document.getElementById('bottom-sheet');
    overlayEl = document.getElementById('bottom-sheet-overlay');
    contentEl = document.getElementById('bottom-sheet-content');
    closeBtn = document.getElementById('bottom-sheet-close');
    resetBtn = document.getElementById('bottom-sheet-reset');
    applyBtn = document.getElementById('bottom-sheet-apply');
    filterBtn = document.getElementById('mobile-filter-btn');
    filterBadge = document.getElementById('filter-badge');

    if (!sheetEl) {
      console.warn('[BottomSheet] Sheet element not found');
      return;
    }

    // Event listeners (Attach these immediately)
    filterBtn?.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    overlayEl?.addEventListener('click', close);
    resetBtn?.addEventListener('click', resetFilters);
    applyBtn?.addEventListener('click', applyFilters);

    // Touch gestures for drag to close
    sheetEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    sheetEl.addEventListener('touchmove', handleTouchMove, { passive: false });
    sheetEl.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Keyboard accessibility
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    });

    // Listen for filter changes to update badge
    window.addEventListener('dataFiltered', updateBadge);

    // Guard: Check if sidebar filters are populated before cloning
    const sidebar = document.querySelector('.filters-container');
    const checkboxes = sidebar?.querySelectorAll('input[type="checkbox"]');

    if (!checkboxes || checkboxes.length === 0) {
      console.warn('[BottomSheet] Filters not yet populated, deferring initialization');
      // Listen for filtersReady event and re-initialize content
      window.addEventListener('filtersReady', () => {
        console.log('[BottomSheet] Filters ready, refreshing content');
        refreshFilters();
      }, { once: true });
      return;
    }

    // Clone filter content from sidebar
    cloneFilterContent();

    console.log('[BottomSheet] Initialized');
  }

  /**
   * Clone filter content from sidebar
   */
  function cloneFilterContent() {
    const sidebar = document.querySelector('.filters-container');
    if (!sidebar || !contentEl) return;

    // Clone the filter groups (not the stats summary)
    const filterGroups = sidebar.querySelectorAll('.filter-group');
    filterGroups.forEach((group) => {
      const clone = group.cloneNode(true);

      // Update IDs to avoid conflicts
      const originalId = clone.querySelector('[id]')?.id;
      if (originalId) {
        clone.querySelectorAll('[id]').forEach((el) => {
          el.id = `bottom-sheet-${el.id}`;
        });
        clone.querySelectorAll('[for]').forEach((el) => {
          el.setAttribute('for', `bottom-sheet-${el.getAttribute('for')}`);
        });
      }

      contentEl.appendChild(clone);
    });

    // Setup event listeners on cloned checkboxes
    setupCheckboxListeners();

    // Setup listeners for multi-select dropdowns (Refactor)
    setupDropdownListeners();
  }

  /**
   * Setup listeners on cloned checkboxes and autocomplete
   */
  function setupCheckboxListeners() {
    if (!contentEl) return;

    // Generic handler for multi-select chips
    const updateChips = (wrapper) => {
      if (!wrapper) return;
      const chipsContainer = wrapper.querySelector('.filter-chips');
      const dropdown = wrapper.querySelector('.filter-dropdown-menu');
      const trigger = wrapper.querySelector('.filter-dropdown-trigger');

      if (!chipsContainer || !dropdown || !trigger) return;

      const checkedBoxes = dropdown.querySelectorAll('input:checked');

      // Update Trigger
      trigger.textContent = checkedBoxes.length > 0
        ? `${checkedBoxes.length} sélectionné${checkedBoxes.length > 1 ? 's' : ''}`
        : 'Sélectionner...';
      trigger.style.borderColor = checkedBoxes.length > 0 ? 'var(--color-primary)' : '';

      // Render Chips
      chipsContainer.innerHTML = Array.from(checkedBoxes).map(cb => {
        const text = cb.parentElement.textContent.replace('●', '').trim();
        return `
             <span class="filter-chip">
               ${text}
               <button class="filter-chip-remove" data-value="${cb.value}">&times;</button>
             </span>
           `;
      }).join('');

      // Remove Handler
      chipsContainer.querySelectorAll('.filter-chip-remove').forEach(btn => {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const val = ev.target.dataset.value;
          const cb = dropdown.querySelector(`input[value="${val}"]`);
          if (cb) {
            cb.checked = false;
            // Trigger change to update data and UI
            cb.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      });
    };

    // Job family checkboxes
    const jobFamilyContainer = contentEl.querySelector('[id*="filter-job-family"]');
    if (jobFamilyContainer) {
      jobFamilyContainer.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
          const value = e.target.value;
          if (e.target.checked) {
            if (!pendingFilters.jobFamilies.includes(value)) pendingFilters.jobFamilies.push(value);
          } else {
            pendingFilters.jobFamilies = pendingFilters.jobFamilies.filter(v => v !== value);
          }
          // Update UI
          updateChips(e.target.closest('.multi-select-container'));
        }
      });
    }

    // Contract type checkboxes
    const contractContainer = contentEl.querySelector('[id*="filter-contract"]');
    if (contractContainer) {
      contractContainer.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
          const value = e.target.value;
          if (e.target.checked) {
            if (!pendingFilters.contractTypes.includes(value)) pendingFilters.contractTypes.push(value);
          } else {
            pendingFilters.contractTypes = pendingFilters.contractTypes.filter(v => v !== value);
          }
          // Update UI
          updateChips(e.target.closest('.multi-select-container'));
        }
      });
    }

    // Department autocomplete + chips
    setupDepartmentAutocomplete();
  }

  /**
   * Setup listeners for multi-select dropdowns
   */
  function setupDropdownListeners() {
    if (!contentEl) return;

    // For each multi-select container found in the bottom sheet
    contentEl.querySelectorAll('.multi-select-container').forEach(container => {
      const trigger = container.querySelector('.filter-dropdown-trigger');
      const dropdown = container.querySelector('.filter-dropdown-menu');

      if (!trigger || !dropdown) return;

      // Toggle
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = dropdown.classList.contains('active');
        // Close others in bottom sheet
        contentEl.querySelectorAll('.filter-dropdown-menu').forEach(d => d.classList.remove('active'));
        if (!isActive) dropdown.classList.add('active');
      });

      // Close when clicking outside (handled by contentEl click listener below)
    });

    // Close dropdowns when clicking anywhere in contentEl that isn't a trigger/menu
    contentEl.addEventListener('click', (e) => {
      if (!e.target.closest('.filter-dropdown-wrapper')) {
        contentEl.querySelectorAll('.filter-dropdown-menu').forEach(d => d.classList.remove('active'));
      }
    });
  }

  /**
   * Setup department autocomplete + chips for bottom sheet
   */
  function setupDepartmentAutocomplete() {
    const input = contentEl.querySelector('[id*="dept-search"]');
    const dropdown = contentEl.querySelector('[id*="dept-dropdown"]');
    const chipsContainer = contentEl.querySelector('[id*="dept-chips"]');

    if (!input || !dropdown || !chipsContainer) return;

    let highlightedIndex = -1;

    // Render chips
    const renderChips = () => {
      chipsContainer.innerHTML = pendingFilters.departments.map(code => {
        const name = departments[code] || code;
        return `
          <span class="dept-chip" data-code="${code}">
            ${name} (${code})
            <button class="dept-chip-remove" aria-label="Retirer ${name}">&times;</button>
          </span>
        `;
      }).join('');

      // Chip remove handlers
      chipsContainer.querySelectorAll('.dept-chip-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const chip = e.target.closest('.dept-chip');
          const code = chip.dataset.code;
          pendingFilters.departments = pendingFilters.departments.filter(d => d !== code);
          renderChips();
        });
      });
    };

    // Render dropdown
    const renderDropdown = (query) => {
      if (!query || query.length < 1) {
        dropdown.hidden = true;
        return;
      }

      const deptEntries = Object.entries(departments);
      const matches = deptEntries
        .filter(([code, name]) =>
          !pendingFilters.departments.includes(code) && (
            code.toLowerCase().includes(query) ||
            name.toLowerCase().includes(query)
          )
        )
        .slice(0, 8);

      if (matches.length === 0) {
        dropdown.innerHTML = '<div class="dept-no-results">Aucun résultat</div>';
      } else {
        dropdown.innerHTML = matches.map(([code, name], i) => `
          <div class="dept-option ${i === highlightedIndex ? 'highlighted' : ''}"
               data-code="${code}"
               data-index="${i}"
               role="option">
            <span class="dept-option-code">${code}</span>
            ${name}
          </div>
        `).join('');
      }

      dropdown.hidden = false;

      // Click handlers
      dropdown.querySelectorAll('.dept-option').forEach(opt => {
        opt.addEventListener('click', () => selectDept(opt.dataset.code));
      });
    };

    // Select department
    const selectDept = (code) => {
      if (!pendingFilters.departments.includes(code)) {
        pendingFilters.departments.push(code);
      }
      input.value = '';
      dropdown.hidden = true;
      highlightedIndex = -1;
      renderChips();
    };

    // Input handler with debounce
    let debounceTimer;
    input.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        highlightedIndex = -1;
        renderDropdown(e.target.value.toLowerCase());
      }, 100);
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
      const options = dropdown.querySelectorAll('.dept-option');

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightedIndex = Math.min(highlightedIndex + 1, options.length - 1);
        updateHighlight(options);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, 0);
        updateHighlight(options);
      } else if (e.key === 'Enter' && highlightedIndex >= 0) {
        e.preventDefault();
        const code = options[highlightedIndex]?.dataset.code;
        if (code) selectDept(code);
      } else if (e.key === 'Escape') {
        dropdown.hidden = true;
        highlightedIndex = -1;
      }
    });

    const updateHighlight = (options) => {
      options.forEach((opt, i) => {
        opt.classList.toggle('highlighted', i === highlightedIndex);
      });
    };

    // Close on outside click within bottom sheet
    contentEl.addEventListener('click', (e) => {
      if (!e.target.closest('.dept-autocomplete')) {
        dropdown.hidden = true;
      }
    });

    // Focus shows dropdown if there's text
    input.addEventListener('focus', () => {
      if (input.value.length >= 1) {
        renderDropdown(input.value.toLowerCase());
      }
    });

    // Store renderChips for external use (sync)
    contentEl._renderDeptChips = renderChips;
  }

  /**
   * Sync bottom sheet checkboxes with sidebar state
   */
  function syncWithSidebar() {
    // Get current filter state from DataProcessor
    const currentFilters = DataProcessor.filters;
    pendingFilters = {
      jobFamilies: [...currentFilters.jobFamilies],
      contractTypes: [...currentFilters.contractTypes],
      departments: [...currentFilters.departments]
    };

    // Update checkboxes in bottom sheet
    if (!contentEl) return;

    // Job families
    contentEl.querySelectorAll('[id$="filter-job-family"] input[type="checkbox"]').forEach((cb) => {
      cb.checked = pendingFilters.jobFamilies.includes(cb.value);
    });

    // Contract types
    contentEl.querySelectorAll('[id$="filter-contract"] input[type="checkbox"]').forEach((cb) => {
      cb.checked = pendingFilters.contractTypes.includes(cb.value);
    });

    // Departments - render chips
    if (contentEl._renderDeptChips) {
      contentEl._renderDeptChips();
    }
  }

  /**
  /**
   * Open the bottom sheet
   */
  function open() {
    if (!sheetEl || !overlayEl) {
      console.error('[BottomSheet] Open failed: Elements not found', { sheetEl, overlayEl });
      return;
    }

    // Sync state before opening
    syncWithSidebar();

    isOpen = true;
    sheetEl.hidden = false;
    overlayEl.hidden = false;

    // Trigger animation
    requestAnimationFrame(() => {
      sheetEl.classList.add('open');
      overlayEl.classList.add('visible');
    });

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Focus management
    closeBtn?.focus();
  }

  /**
   * Close the bottom sheet
   */
  function close() {
    if (!sheetEl || !overlayEl) return;

    isOpen = false;
    sheetEl.classList.remove('open');
    overlayEl.classList.remove('visible');

    // Wait for animation
    setTimeout(() => {
      sheetEl.hidden = true;
      overlayEl.hidden = true;
    }, 300);

    // Restore body scroll
    document.body.style.overflow = '';

    // Return focus to filter button
    filterBtn?.focus();
  }

  /**
   * Handle touch start for drag gesture
   */
  function handleTouchStart(e) {
    const handle = sheetEl.querySelector('.bottom-sheet-handle');
    const header = sheetEl.querySelector('.bottom-sheet-header');

    // Only allow drag from handle or header
    if (!handle?.contains(e.target) && !header?.contains(e.target)) return;

    isDragging = true;
    startY = e.touches[0].clientY;
    currentY = startY;
    sheetEl.style.transition = 'none';
  }

  /**
   * Handle touch move for drag gesture
   */
  function handleTouchMove(e) {
    if (!isDragging) return;

    currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;

    // Only allow dragging down
    if (deltaY > 0) {
      e.preventDefault();
      sheetEl.style.transform = `translateY(${deltaY}px)`;
    }
  }

  /**
   * Handle touch end for drag gesture
   */
  function handleTouchEnd() {
    if (!isDragging) return;

    isDragging = false;
    sheetEl.style.transition = '';
    sheetEl.style.transform = '';

    const deltaY = currentY - startY;

    // Close if dragged more than 100px
    if (deltaY > 100) {
      close();
    }
  }

  /**
   * Reset filters in bottom sheet
   */
  function resetFilters() {
    pendingFilters = {
      jobFamilies: [],
      contractTypes: [],
      departments: []
    };

    // Uncheck all checkboxes
    if (contentEl) {
      contentEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        cb.checked = false;
      });
    }

    // Clear department autocomplete
    const deptSearch = contentEl?.querySelector('[id*="dept-search"]');
    const deptDropdown = contentEl?.querySelector('[id*="dept-dropdown"]');
    if (deptSearch) {
      deptSearch.value = '';
    }
    if (deptDropdown) {
      deptDropdown.hidden = true;
    }

    // Clear department chips
    if (contentEl._renderDeptChips) {
      contentEl._renderDeptChips();
    }

    // Explicitly clear multi-select chips and reset triggers (Job Family, Contract)
    if (contentEl) {
      // Clear chips
      contentEl.querySelectorAll('.filter-chips').forEach(container => {
        container.innerHTML = '';
      });

      // Reset triggers
      contentEl.querySelectorAll('.filter-dropdown-trigger').forEach(trigger => {
        trigger.textContent = 'Sélectionner...';
        trigger.style.borderColor = '';
      });
    }

    // Immediately apply the cleared filters
    applyFilters();
  }

  /**
   * Apply filters and close
   */
  function applyFilters() {
    // Apply filters through DataProcessor
    DataProcessor.applyFilters(pendingFilters);

    // Also sync sidebar checkboxes
    syncSidebarWithPending();

    close();
  }

  /**
   * Sync sidebar checkboxes with pending filters
   */
  function syncSidebarWithPending() {
    // Job families
    document.querySelectorAll('#filter-job-family input[type="checkbox"]').forEach((cb) => {
      cb.checked = pendingFilters.jobFamilies.includes(cb.value);
    });

    // Contract types
    document.querySelectorAll('#filter-contract input[type="checkbox"]').forEach((cb) => {
      cb.checked = pendingFilters.contractTypes.includes(cb.value);
    });

    // Departments - sync with App's selectedDepts and re-render chips
    if (window.App) {
      App.selectedDepts = new Set(pendingFilters.departments);
      // Re-render chips in sidebar
      const chipsContainer = document.getElementById('dept-chips');
      if (chipsContainer) {
        chipsContainer.innerHTML = pendingFilters.departments.map(code => {
          const name = departments[code] || code;
          return `
            <span class="dept-chip" data-code="${code}">
              ${name} (${code})
              <button class="dept-chip-remove" aria-label="Retirer ${name}">&times;</button>
            </span>
          `;
        }).join('');

        // Re-attach event listeners for chip removal
        chipsContainer.querySelectorAll('.dept-chip-remove').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const chip = e.target.closest('.dept-chip');
            const code = chip.dataset.code;
            App.selectedDepts.delete(code);
            chip.remove();
            App.applyFilters();
          });
        });
      }
    }
  }

  /**
   * Update the filter badge count
   */
  function updateBadge() {
    if (!filterBadge) return;

    const filters = DataProcessor.filters;
    const count = filters.jobFamilies.length +
      filters.contractTypes.length +
      filters.departments.length;

    if (count > 0) {
      filterBadge.textContent = count;
      filterBadge.hidden = false;
    } else {
      filterBadge.hidden = true;
    }
  }

  /**
   * Check if sheet is open
   */
  function isSheetOpen() {
    return isOpen;
  }

  /**
   * Refresh filter content from sidebar (used when filters are populated after init)
   */
  function refreshFilters() {
    if (!contentEl) return;

    // Clear existing content
    contentEl.innerHTML = '';

    // Re-clone filter content
    cloneFilterContent();

    console.log('[BottomSheet] Filters refreshed');
  }

  /**
   * Set department data for search (DS-1: Share Data Source)
   * @param {Object} deptData - Department code to name mapping
   */
  function setDepartmentData(deptData) {
    departments = deptData || {};
    console.log('[BottomSheet] Department data set:', Object.keys(departments).length, 'departments');
  }

  // Public API
  return {
    init,
    open,
    close,
    isOpen: isSheetOpen,
    updateBadge,
    refreshFilters,
    setDepartmentData
  };
})();

// Export for use in other modules
window.BottomSheet = BottomSheet;
