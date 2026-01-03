/**
 * Main Application
 * Initializes and coordinates all components
 * With PWA support for offline-first experience
 */

const App = {
  currentTab: 'overview',

  /**
   * Initialize the application
   */
  async init() {
    try {
      // Show loading state
      document.body.classList.add('loading');

      // 1. Load data first (with offline support)
      await DataProcessor.loadData();

      // 2. Initialize filters (populates sidebar checkboxes)
      this.initFilters();

      // 3. THEN initialize PWA components (bottom sheet clones populated filters)
      // This order is critical: bottom sheet clones filter DOM after filters are populated
      this.initPWAComponents();

      // Show data source indicator
      this.showDataSourceIndicator();
      this.initTabs();
      this.initRouter();
      this.initSalaryToggles();
      this.initMapControls();
      this.initOffersCTA();

      // Initialize visualizations
      Charts.init();
      Timeline.init();
      DossierMetiers.init();

      // Update stats display
      this.updateStats();
      this.updateMetrics();

      // Update all charts
      Charts.update();

      // Listen for filter changes
      window.addEventListener('dataFiltered', () => {
        this.updateStats();
        this.updateMetrics();
        Charts.update();
        Timeline.update();
        DossierMetiers.update();
        if (this.currentTab === 'map') {
          FranceMap.update();
        }
      });

      // Listen for data refresh (when coming back online)
      window.addEventListener('dataRefreshed', () => {
        console.log('[App] Data refreshed, updating UI...');
        this.updateStats();
        this.updateMetrics();
        Charts.update();
        Timeline.update();
        DossierMetiers.update();
        if (this.currentTab === 'map') {
          FranceMap.update();
        }
        this.showDataSourceIndicator();
      });

      // Initialize URL router (handles deep linking)
      if (window.Router) {
        Router.init();
      }

      document.body.classList.remove('loading');
      console.log('[App] Application initialized successfully');
    } catch (error) {
      console.error('[App] Failed to initialize:', error);

      // Remove loading state
      document.body.classList.remove('loading');

      // Show friendly error toast
      if (window.ErrorToast) {
        ErrorToast.init();
        if (!navigator.onLine) {
          ErrorToast.showNetworkError(8000);
        } else {
          ErrorToast.showDataError(8000);
        }
      }

      // Add js-error class to allow noscript content to show as fallback
      document.body.classList.add('js-error');

      // Also show a retry button in the main content area
      const contentArea = document.querySelector('.content-area');
      if (contentArea) {
        contentArea.innerHTML = `
          <div style="text-align: center; padding: 50px; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #1e293b; margin-bottom: 16px;">Erreur de chargement</h2>
            <p style="color: #64748b; margin-bottom: 24px;">${navigator.onLine
            ? 'Impossible de charger les données. Veuillez réessayer.'
            : 'Vous êtes hors-ligne et aucune donnée n\'est en cache.'
          }</p>
            <button onclick="window.location.reload()" style="padding: 12px 24px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
              Rafraîchir la page
            </button>
          </div>
        `;
      }
    }
  },

  /**
   * Initialize PWA-specific components
   */
  initPWAComponents() {
    // Initialize update toast (handles SW updates)
    if (window.UpdateToast) {
      UpdateToast.init();
    }

    // Initialize bottom sheet (mobile filters)
    if (window.BottomSheet) {
      BottomSheet.init();
      // DS-1: Share department data with bottom sheet for search
      const data = DataProcessor.getData();
      if (data?.departments) {
        BottomSheet.setDepartmentData(data.departments);
      }
    }

    // Initialize swipe navigation (tab swiping)
    if (window.SwipeNavigation) {
      SwipeNavigation.init();
    }

    console.log('[App] PWA components initialized');
  },

  /**
   * Show indicator of where data came from (cache vs network)
   */
  showDataSourceIndicator() {
    const source = DataProcessor.getDataSource?.() || 'unknown';
    if (source === 'cache') {
      console.log('[App] Using cached data');
      // Could show a subtle indicator that data is from cache
    }
  },

  /**
   * Initialize filter controls
   */
  initFilters() {
    const data = DataProcessor.getData();

    // Helper: Initialize Multi-select Dropdown (Supports Hierarchy)
    const initMultiSelect = (type, items, colorFn = null) => {
      const wrapper = document.getElementById(`filter-${type}-container`);
      const trigger = document.getElementById(`filter-${type}-trigger`);
      const dropdown = document.getElementById(`filter-${type}-dropdown`);
      const chipsContainer = document.getElementById(`filter-${type}-chips`);

      if (!wrapper || !trigger || !dropdown || !chipsContainer) return;

      // Render Dropdown Items
      // Items can be Strings OR Objects: { label: 'Group', items: [...] }
      const renderItem = (item, level = 0) => {
        if (typeof item === 'string' || (item.label && !item.items)) {
          // Leaf node
          const value = typeof item === 'string' ? item : item.value || item.label;
          const label = typeof item === 'string' ? item : item.label;
          const color = colorFn ? colorFn(value) : null;
          const style = color ? `style="color: ${color}; font-weight: bold; margin-right: 4px;"` : '';
          const indent = level * 16;

          return `
            <label class="filter-dropdown-item" style="padding-left: ${8 + indent}px">
              <input type="checkbox" value="${value}" class="filter-${type}-cb" data-level="${level}">
              ${style ? `<span ${style}>●</span>` : ''}
              ${label}
            </label>
          `;
        } else if (item.items) {
          // Group node
          const indent = level * 16;
          // Group Header with "Select All" capability
          const groupHtml = `
            <div class="filter-dropdown-group">
              <label class="filter-dropdown-group-header" style="padding-left: ${8 + indent}px; font-weight: bold; background: var(--color-surface-alt); cursor: pointer;">
                <input type="checkbox" class="filter-group-cb" value="${item.label}">
                ${item.label}
                 <span style="font-size: 0.8em; color: var(--color-text-muted); font-weight: normal; margin-left: 4px;">(${item.items.length})</span>
              </label>
              <div class="filter-dropdown-group-items">
                ${item.items.map(subItem => renderItem(subItem, level + 1)).join('')}
              </div>
            </div>
          `;
          return groupHtml;
        }
      };

      dropdown.innerHTML = items.map(i => renderItem(i)).join('');

      // Update Chips UI based on checks
      const updateChips = () => {
        // Only count leaf checkboxes (level > 0 OR top-level leaf)
        // Actually, we rely on class filter-{type}-cb. Group CBs are filter-group-cb.
        const checkedBoxes = dropdown.querySelectorAll(`.filter-${type}-cb:checked`);
        trigger.textContent = checkedBoxes.length > 0
          ? `${checkedBoxes.length} sélectionné${checkedBoxes.length > 1 ? 's' : ''}`
          : 'Sélectionner...';

        if (checkedBoxes.length > 0) trigger.style.borderColor = 'var(--color-primary)';
        else trigger.style.borderColor = '';

        chipsContainer.innerHTML = Array.from(checkedBoxes).map(cb => {
          const text = cb.parentElement.textContent.replace('●', '').trim();
          return `
             <span class="filter-chip">
               ${text}
               <button class="filter-chip-remove" data-value="${cb.value}">&times;</button>
             </span>
           `;
        }).join('');

        // Re-bind remove buttons
        chipsContainer.querySelectorAll('.filter-chip-remove').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const val = e.target.dataset.value;
            const cb = dropdown.querySelector(`.filter-${type}-cb[value="${val}"]`);
            if (cb) {
              cb.checked = false;
              // If child unchecked, also uncheck group parent if needed (optional UX)
              const group = cb.closest('.filter-dropdown-group');
              if (group) {
                const groupCb = group.querySelector('.filter-group-cb');
                if (groupCb) groupCb.checked = false;
              }
              updateChips();
              this.applyFilters();
            }
          });
        });
      };

      const toggleDropdown = (forceClose = false) => {
        if (forceClose) {
          dropdown.classList.remove('active');
        } else {
          const wasActive = dropdown.classList.contains('active');
          document.querySelectorAll('.filter-dropdown-menu').forEach(d => d.classList.remove('active'));
          if (!wasActive) dropdown.classList.add('active');
        }
      };

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown();
      });

      // Individual Checkbox Logic
      dropdown.querySelectorAll(`.filter-${type}-cb`).forEach(cb => {
        cb.addEventListener('change', (e) => {
          // Check if all siblings are checked, update parent? (Optional)
          updateChips();
          this.applyFilters();
        });
      });

      // Group Checkbox Logic
      dropdown.querySelectorAll('.filter-group-cb').forEach(groupCb => {
        groupCb.addEventListener('change', (e) => {
          const group = e.target.closest('.filter-dropdown-group');
          const children = group.querySelectorAll(`.filter-${type}-cb`);
          children.forEach(c => c.checked = e.target.checked);
          updateChips();
          this.applyFilters();
        });
      });
    };

    // 1. Job Families
    // Keep flat list for families
    const families = JobClassifier.getAllFamilyNames().sort((a, b) => a.localeCompare(b, 'fr'));
    initMultiSelect('job-family', families, (f) => JobClassifier.getColor(f));

    // 2. Contract Types (Grouped & Sorted)
    const extractDuration = (contract) => {
      const monthMatch = contract.match(/(\d+)\s*Mois/i);
      if (monthMatch) return parseInt(monthMatch[1]) * 30;
      const dayMatch = contract.match(/(\d+)\s*Jours?/i);
      if (dayMatch) return parseInt(dayMatch[1]);
      return 0; // No duration (e.g. CDI)
    };

    const rawContracts = Object.keys(data.byContractType);

    // Define Groups
    const groups = {
      'CDI': [],
      'CDD': [],
      'Intérim': [],
      'Saisonnier': [],
      'Autre': []
    };

    rawContracts.forEach(c => {
      if (c.startsWith('CDI')) groups['CDI'].push(c);
      else if (c.startsWith('CDD')) groups['CDD'].push(c);
      else if (c.startsWith('Intérim')) groups['Intérim'].push(c);
      else if (c.toLowerCase().includes('saisonnier')) groups['Saisonnier'].push(c);
      else groups['Autre'].push(c);
    });

    // Sort items within groups (Duration DESC)
    const sortDurationDesc = (a, b) => extractDuration(b) - extractDuration(a);
    groups['CDD'].sort(sortDurationDesc);
    groups['Intérim'].sort(sortDurationDesc);
    groups['Saisonnier'].sort(sortDurationDesc);
    groups['Autre'].sort((a, b) => a.localeCompare(b, 'fr'));

    // Construct Data Structure for Renderer
    const contractItems = [];

    // CDI first (Flat or Group? "option" says group options... usually CDI is single. But let's verify if there are variants)
    // If only "CDI", maybe add as flat item? But consistency is nice.
    if (groups['CDI'].length > 0) {
      // If just 1 CDI, maybe flat? "CDI" is usually just "CDI".
      // But let's check aggregated data.
      // If multiples, group them.
      groups['CDI'].forEach(c => contractItems.push(c));
    }

    // CDD Group
    if (groups['CDD'].length > 0) {
      contractItems.push({ label: 'CDD', items: groups['CDD'] });
    }

    // Intérim Group
    if (groups['Intérim'].length > 0) {
      contractItems.push({ label: 'Intérim', items: groups['Intérim'] });
    }

    // Saisonnier Group
    if (groups['Saisonnier'].length > 0) {
      contractItems.push({ label: 'Saisonnier', items: groups['Saisonnier'] });
    }

    // Others (Flat or Group?)
    if (groups['Autre'].length > 0) {
      contractItems.push({ label: 'Autres', items: groups['Autre'] });
    }

    initMultiSelect('contract', contractItems);

    // Global Click Listener to close dropdowns
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.filter-dropdown-wrapper')) {
        document.querySelectorAll('.filter-dropdown-menu').forEach(d => d.classList.remove('active'));
      }
    });

    // Department autocomplete + chips
    this.initDepartmentAutocomplete(data);

    // Reset button logic update
    const resetBtn = document.getElementById('reset-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        document.querySelectorAll('.filter-job-family-cb, .filter-contract-cb, .filter-group-cb')
          .forEach(cb => {
            cb.checked = false;
            // Trigger change manually or call updateChips logic if exposed?
            // Simplest: just dispatch event or call init logic again?
            // We can manually clear chips and reset text.
          });

        // Reset UI text/chips manually since the closure reference is lost
        ['job-family', 'contract'].forEach(type => {
          document.getElementById(`filter-${type}-trigger`).textContent = 'Sélectionner...';
          document.getElementById(`filter-${type}-chips`).innerHTML = '';
          document.getElementById(`filter-${type}-trigger`).style.borderColor = '';
        });

        // Clear dept
        const deptInput = document.getElementById('dept-search');
        if (deptInput) deptInput.value = '';
        this.clearSelectedDepartments();

        DataProcessor.resetFilters();
      });
    }

    // Dispatch event signaling filters are ready
    window.dispatchEvent(new CustomEvent('filtersReady'));
    console.log('[App] Filters initialized (Multi-select Refactor)');
  },

  /**
   * Initialize scroll indicators for filter groups
   */
  initScrollIndicators() {
    document.querySelectorAll('.checkbox-group').forEach(group => {
      const wrapper = group.parentElement;
      if (!wrapper?.classList.contains('checkbox-group-wrapper')) return;

      const checkScroll = () => {
        const isAtEnd = group.scrollHeight - group.scrollTop <= group.clientHeight + 5;
        const isScrollable = group.scrollHeight > group.clientHeight;

        if (!isScrollable || isAtEnd) {
          wrapper.classList.add('scrolled-end');
        } else {
          wrapper.classList.remove('scrolled-end');
        }
      };

      group.addEventListener('scroll', checkScroll);
      // Initial check
      setTimeout(checkScroll, 100);
    });
  },

  // Selected departments state for autocomplete
  selectedDepts: new Set(),

  /**
   * Initialize department autocomplete + chips
   */
  initDepartmentAutocomplete(data) {
    const input = document.getElementById('dept-search');
    const dropdown = document.getElementById('dept-dropdown');
    const chipsContainer = document.getElementById('dept-chips');

    if (!input || !dropdown || !chipsContainer) return;

    const departments = Object.entries(data.departments);
    let highlightedIndex = -1;

    // Render chips
    const renderChips = () => {
      chipsContainer.innerHTML = Array.from(this.selectedDepts).map(code => {
        const name = data.departments[code];
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
          this.selectedDepts.delete(code);
          renderChips();
          this.applyFilters();
        });
      });
    };

    // Render dropdown
    const renderDropdown = (query) => {
      if (!query || query.length < 1) {
        dropdown.hidden = true;
        return;
      }

      const matches = departments
        .filter(([code, name]) =>
          !this.selectedDepts.has(code) && (
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
      this.selectedDepts.add(code);
      input.value = '';
      dropdown.hidden = true;
      highlightedIndex = -1;
      renderChips();
      this.applyFilters();
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

    // Close on outside click
    document.addEventListener('click', (e) => {
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
  },

  /**
   * Get selected departments (for external use)
   */
  getSelectedDepartments() {
    return Array.from(this.selectedDepts);
  },

  /**
   * Clear selected departments (for reset)
   */
  clearSelectedDepartments() {
    this.selectedDepts.clear();
    const chipsContainer = document.getElementById('dept-chips');
    if (chipsContainer) {
      chipsContainer.innerHTML = '';
    }
  },

  /**
   * Apply current filter selections
   */
  applyFilters() {
    const jobFamilies = Array.from(document.querySelectorAll('.filter-job-family-cb:checked'))
      .map(cb => cb.value);

    const contractTypes = Array.from(document.querySelectorAll('.filter-contract-cb:checked'))
      .map(cb => cb.value);

    // Get from chips instead of checkboxes
    const departments = Array.from(this.selectedDepts);

    DataProcessor.applyFilters({ jobFamilies, contractTypes, departments });
  },

  /**
   * Initialize tab navigation
   */
  initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;

        // Update active states
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        contents.forEach(c => {
          c.classList.remove('active');
          if (c.id === `tab-${target}`) {
            c.classList.add('active');
          }
        });

        this.currentTab = target;

        // Dispatch event for router
        window.dispatchEvent(new CustomEvent('tabChanged', {
          detail: { tab: target }
        }));

        // Sync with SwipeNavigation if available
        if (window.SwipeNavigation) {
          SwipeNavigation.setCurrentTab(target);
        }

        // Initialize map when tab is shown (lazy loading)
        if (target === 'map' && !FranceMap.svg) {
          FranceMap.init();
        }

        // Update sector treemap
        if (target === 'sectors') {
          this.renderSectorTreemap();
          this.renderSectorTable();
        }
      });
    });
  },

  /**
   * Initialize router integration
   */
  initRouter() {
    // Check initial route
    if (window.HashRouter) {
      const path = HashRouter.getPath();
      this.handleRoute(path);

      // Listen for changes
      window.addEventListener('hashRouteChanged', (e) => {
        this.handleRoute(e.detail.path);
      });
    }
  },

  /**
   * Handle route change
   */
  handleRoute(path) {
    // Simple mapping: /route -> tab-name
    // e.g. /map -> map, /salaires -> salaries
    const route = path.replace('/', '');
    let targetTab = 'overview'; // default

    if (route === 'map' || route === 'carte') targetTab = 'map';
    else if (route === 'salaries' || route === 'salaires') targetTab = 'salaries';
    else if (route === 'sectors' || route === 'secteurs') targetTab = 'sectors';
    else if (route === 'dossier') targetTab = 'dossier';

    // Switch tab if needed
    if (targetTab !== this.currentTab) {
      const tabBtn = document.querySelector(`.tab-btn[data-tab="${targetTab}"]`);
      if (tabBtn) {
        tabBtn.click();
      }
    }
  },

  /**
   * Initialize salary toggle buttons
   */
  initSalaryToggles() {
    // Salary type toggles
    document.querySelectorAll('[data-salary-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-salary-type]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Charts.setSalaryType(btn.dataset.salaryType);
      });
    });

    // Salary period toggles
    document.querySelectorAll('[data-salary-period]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-salary-period]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Charts.setSalaryPeriod(btn.dataset.salaryPeriod);
      });
    });
  },

  /**
   * Initialize map controls
   */
  initMapControls() {
    document.querySelectorAll('[data-map-color]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-map-color]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        FranceMap.setColorMode(btn.dataset.mapColor);
      });
    });
  },

  /**
   * Initialize offers CTA buttons
   */
  initOffersCTA() {
    document.querySelectorAll('.btn-cta').forEach(btn => {
      btn.addEventListener('click', () => {
        const context = btn.dataset.context;
        let offers = DataProcessor.getOffers(true);
        let contextLabel = 'Toutes les offres filtrées';

        if (context === 'with-salary') {
          offers = offers.filter(o => o.salaryNetMonthly);
          contextLabel = 'Offres avec salaire renseigné';
        }

        OffersModal.show(offers, contextLabel);
      });
    });
  },

  /**
   * Update stats summary in sidebar
   */
  updateStats() {
    const data = DataProcessor.getData();
    const stats = DataProcessor.getStats();

    document.getElementById('total-offers').textContent = SalaryUtils.formatNumber(stats.total);
    document.getElementById('offers-with-salary').textContent = SalaryUtils.formatNumber(stats.withSalary);

    const dateRange = `${data.meta.dateRange.first.slice(5)} - ${data.meta.dateRange.last.slice(5)}`;
    document.getElementById('date-range').textContent = dateRange;
  },

  /**
   * Update metrics cards
   */
  updateMetrics() {
    const stats = DataProcessor.getStats();

    document.getElementById('metric-total').textContent = SalaryUtils.formatNumber(stats.total);
    document.getElementById('metric-sectors').textContent = Object.keys(stats.bySector).length;
    document.getElementById('metric-depts').textContent = Object.keys(stats.byDepartment).length;
  },

  /**
   * Render sector treemap
   */
  // Colorblind-safe palette (based on Wong's palette + extensions)
  colorblindPalette: [
    '#0077BB', // blue
    '#EE7733', // orange
    '#009988', // teal
    '#CC3311', // red
    '#33BBEE', // cyan
    '#EE3377', // magenta
    '#BBBBBB', // grey
    '#AA3377', // purple
    '#44BB99', // mint
    '#DDCC77', // sand
    '#882255', // wine
    '#332288', // indigo
    '#117733', // green
    '#999933', // olive
    '#CC6677', // rose
  ],

  // Store sector colors for reuse in table
  sectorColors: {},

  renderSectorTreemap() {
    const container = document.getElementById('sector-treemap');
    if (!container) return;

    const stats = DataProcessor.getStats();
    const data = Object.entries(stats.bySector)
      .filter(([name]) => name.toLowerCase() !== 'non précisé')
      .map(([name, d]) => ({ name, value: d.count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);

    // Clear existing
    container.innerHTML = '';

    const width = container.clientWidth;
    const height = 400;

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const root = d3.hierarchy({ children: data })
      .sum(d => d.value);

    d3.treemap()
      .size([width, height])
      .padding(2)(root);

    // Use colorblind-safe palette
    const color = d3.scaleOrdinal(this.colorblindPalette);

    // Store colors for each sector (for table reuse)
    this.sectorColors = {};
    data.forEach((d, i) => {
      this.sectorColors[d.name] = color(i);
    });

    const nodes = svg.selectAll('g')
      .data(root.leaves())
      .enter()
      .append('g')
      .attr('transform', d => `translate(${d.x0},${d.y0})`);

    nodes.append('rect')
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .attr('fill', (d, i) => color(i))
      .attr('rx', 4)
      .style('cursor', 'pointer')
      .on('click', (e, d) => {
        console.log('Clicked sector:', d.data.name);
      });

    // Use foreignObject for text wrapping
    nodes.append('foreignObject')
      .attr('x', 4)
      .attr('y', 4)
      .attr('width', d => Math.max(0, d.x1 - d.x0 - 8))
      .attr('height', d => Math.max(0, d.y1 - d.y0 - 8))
      .append('xhtml:div')
      .style('width', '100%')
      .style('height', '100%')
      .style('display', 'flex')
      .style('flex-direction', 'column')
      .style('justify-content', 'flex-start')
      .style('overflow', 'hidden')
      .style('color', 'white')
      .style('font-size', '11px')
      .style('line-height', '1.2')
      .style('pointer-events', 'none')
      .html(d => {
        const cellWidth = d.x1 - d.x0;
        const cellHeight = d.y1 - d.y0;
        if (cellWidth < 50 || cellHeight < 30) return '';

        const showCount = cellHeight >= 45;
        return `
          <div style="font-weight: 500; word-wrap: break-word; overflow-wrap: break-word;">${d.data.name}</div>
          ${showCount ? `<div style="opacity: 0.8; font-size: 10px; margin-top: 2px;">${d.data.value} offres</div>` : ''}
        `;
      });
  },

  /**
   * Render sector table
   */
  renderSectorTable() {
    const tbody = document.querySelector('#sector-table tbody');
    if (!tbody) return;

    const stats = DataProcessor.getStats();
    const sectors = Object.entries(stats.bySector)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15);

    tbody.innerHTML = sectors.map(([name, data]) => {
      const color = this.sectorColors[name] || '#BBBBBB';
      return `
        <tr>
          <td>
            <span class="sector-color-dot" style="background-color: ${color}"></span>
            ${name}
          </td>
          <td>${data.count}</td>
          <td>${data.salaryStats ? `${SalaryUtils.formatCurrency(data.salaryStats.median)} <span class="count-badge">(n=${data.salaryStats.count})</span>` : '-'}</td>
        </tr>
      `;
    }).join('');
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
