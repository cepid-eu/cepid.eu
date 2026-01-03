/**
 * Data Processor
 * Loads and filters the aggregated data with offline-first support
 */

const DataProcessor = {
  data: null,
  filteredOffers: null,
  isOffline: !navigator.onLine,
  dataSource: 'none', // 'network', 'cache', or 'none'

  // Current filter state
  filters: {
    jobFamilies: [],
    contractTypes: [],
    departments: [],
    dateRange: null
  },

  /**
   * Load data with offline-first strategy
   * @returns {Promise<object>} The loaded data
   */
  async loadData() {
    console.log('[DataProcessor] Loading data...');

    // Listen for online/offline events
    this.setupOnlineListeners();

    // Try network first if online
    if (navigator.onLine) {
      try {
        const data = await this.fetchFromNetwork();
        if (data) {
          this.data = data;
          this.filteredOffers = [...this.data.offers];
          this.dataSource = 'network';
          // Save to IndexedDB in background
          this.saveToStorage(data);
          return this.data;
        }
      } catch (error) {
        console.warn('[DataProcessor] Network fetch failed:', error.message);
      }
    }

    // Fallback to IndexedDB
    const cachedData = await this.loadFromStorage();
    if (cachedData) {
      this.data = cachedData;
      this.filteredOffers = [...this.data.offers];
      this.dataSource = 'cache';
      console.log('[DataProcessor] Loaded from IndexedDB cache');
      return this.data;
    }

    // No data available
    throw new Error('No data available. Please connect to the internet.');
  },

  /**
   * Fetch data from network
   * @returns {Promise<object|null>} The data or null
   */
  async fetchFromNetwork() {
    console.log('[DataProcessor] Fetching from network...');
    const response = await fetch('data/aggregated.json');
    if (!response.ok) throw new Error('Network response not ok');
    return response.json();
  },

  /**
   * Save data to IndexedDB
   * @param {object} data - The data to save
   */
  async saveToStorage(data) {
    try {
      await Storage.saveAggregatedData(data);
      console.log('[DataProcessor] Data saved to IndexedDB');
    } catch (error) {
      console.error('[DataProcessor] Failed to save to IndexedDB:', error);
    }
  },

  /**
   * Load data from IndexedDB
   * @returns {Promise<object|null>} The cached data or null
   */
  async loadFromStorage() {
    try {
      return await Storage.loadAggregatedData();
    } catch (error) {
      console.error('[DataProcessor] Failed to load from IndexedDB:', error);
      return null;
    }
  },

  /**
   * Setup online/offline event listeners
   */
  setupOnlineListeners() {
    window.addEventListener('online', () => {
      console.log('[DataProcessor] Back online');
      this.isOffline = false;
      this.updateOfflineIndicator(false);
      // Optionally refresh data when coming back online
      this.refreshIfNeeded();
    });

    window.addEventListener('offline', () => {
      console.log('[DataProcessor] Gone offline');
      this.isOffline = true;
      this.updateOfflineIndicator(true);
    });

    // Initial state
    this.updateOfflineIndicator(!navigator.onLine);
  },

  /**
   * Update the offline indicator UI
   * @param {boolean} isOffline - Whether we're offline
   */
  updateOfflineIndicator(isOffline) {
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
      indicator.hidden = !isOffline;
    }
  },

  /**
   * Refresh data if needed (when coming back online)
   */
  async refreshIfNeeded() {
    if (this.dataSource === 'cache') {
      try {
        const networkData = await this.fetchFromNetwork();
        if (networkData) {
          // Check if data is newer
          const cachedVersion = this.data.meta?.generatedAt;
          const newVersion = networkData.meta?.generatedAt;

          if (newVersion && (!cachedVersion || newVersion > cachedVersion)) {
            console.log('[DataProcessor] Newer data available, refreshing...');
            this.data = networkData;
            this.filteredOffers = [...this.data.offers];
            this.dataSource = 'network';
            this.saveToStorage(networkData);

            // Notify UI of data update
            window.dispatchEvent(new CustomEvent('dataRefreshed', {
              detail: { offers: this.filteredOffers }
            }));
          }
        }
      } catch (error) {
        console.warn('[DataProcessor] Background refresh failed:', error);
      }
    }
  },

  /**
   * Check if we have cached data
   * @returns {Promise<boolean>}
   */
  async hasCachedData() {
    return Storage.hasData();
  },

  /**
   * Get the data source
   * @returns {string} 'network', 'cache', or 'none'
   */
  getDataSource() {
    return this.dataSource;
  },

  /**
   * Get the raw data
   * @returns {object} The data object
   */
  getData() {
    return this.data;
  },

  /**
   * Get all offers (filtered or unfiltered)
   * @param {boolean} filtered - Whether to return filtered offers
   * @returns {array} Array of offers
   */
  getOffers(filtered = true) {
    return filtered ? this.filteredOffers : this.data.offers;
  },

  /**
   * Apply filters to the data
   * @param {object} newFilters - Filters to apply
   */
  applyFilters(newFilters) {
    this.filters = { ...this.filters, ...newFilters };
    this.filteredOffers = this.data.offers.filter(offer => {
      // Job family filter
      if (this.filters.jobFamilies.length > 0) {
        if (!this.filters.jobFamilies.includes(offer.jobFamily)) return false;
      }

      // Contract type filter
      if (this.filters.contractTypes.length > 0) {
        if (!this.filters.contractTypes.includes(offer.contractType)) return false;
      }

      // Department filter
      if (this.filters.departments.length > 0) {
        if (!this.filters.departments.includes(offer.department)) return false;
      }

      return true;
    });

    // Dispatch event for chart updates
    window.dispatchEvent(new CustomEvent('dataFiltered', {
      detail: { offers: this.filteredOffers, filters: this.filters }
    }));
  },

  /**
   * Reset all filters
   */
  resetFilters() {
    this.filters = {
      jobFamilies: [],
      contractTypes: [],
      departments: [],
      dateRange: null
    };
    this.filteredOffers = [...this.data.offers];

    window.dispatchEvent(new CustomEvent('dataFiltered', {
      detail: { offers: this.filteredOffers, filters: this.filters }
    }));
  },

  /**
   * Get statistics for filtered data
   * @returns {object} Statistics object
   */
  getStats() {
    const offers = this.filteredOffers;
    const withSalary = offers.filter(o => o.salaryGrossAnnual !== null);

    // By job family
    const byJobFamily = {};
    offers.forEach(o => {
      if (!byJobFamily[o.jobFamily]) {
        byJobFamily[o.jobFamily] = { count: 0, salaries: [] };
      }
      byJobFamily[o.jobFamily].count++;
      if (o.salaryGrossAnnual) {
        byJobFamily[o.jobFamily].salaries.push(o.salaryGrossAnnual);
      }
    });

    // Calculate salary stats
    for (const family in byJobFamily) {
      byJobFamily[family].salaryStats = SalaryUtils.calculateStats(byJobFamily[family].salaries);
      delete byJobFamily[family].salaries;
    }

    // By contract type
    const byContractType = {};
    offers.forEach(o => {
      const type = o.contractType || 'Non précisé';
      if (!byContractType[type]) {
        byContractType[type] = { count: 0, salaries: [] };
      }
      byContractType[type].count++;
      if (o.salaryGrossAnnual) {
        byContractType[type].salaries.push(o.salaryGrossAnnual);
      }
    });

    for (const type in byContractType) {
      byContractType[type].salaryStats = SalaryUtils.calculateStats(byContractType[type].salaries);
      delete byContractType[type].salaries;
    }

    // By department
    const byDepartment = {};
    offers.forEach(o => {
      const dept = o.department || 'Inconnu';
      if (!byDepartment[dept]) {
        byDepartment[dept] = {
          name: this.data.departments[dept] || dept,
          count: 0,
          salaries: []
        };
      }
      byDepartment[dept].count++;
      if (o.salaryGrossAnnual) {
        byDepartment[dept].salaries.push(o.salaryGrossAnnual);
      }
    });

    for (const dept in byDepartment) {
      byDepartment[dept].salaryStats = SalaryUtils.calculateStats(byDepartment[dept].salaries);
      delete byDepartment[dept].salaries;
    }

    // By sector
    const bySector = {};
    offers.forEach(o => {
      const sector = o.sector || 'Non précisé';
      if (!bySector[sector]) {
        bySector[sector] = { count: 0, salaries: [] };
      }
      bySector[sector].count++;
      if (o.salaryGrossAnnual) {
        bySector[sector].salaries.push(o.salaryGrossAnnual);
      }
    });

    for (const sector in bySector) {
      bySector[sector].salaryStats = SalaryUtils.calculateStats(bySector[sector].salaries);
      delete bySector[sector].salaries;
    }

    return {
      total: offers.length,
      withSalary: withSalary.length,
      byJobFamily,
      byContractType,
      byDepartment,
      bySector
    };
  },

  /**
   * Get offers grouped by date for timeline
   * @returns {object} Offers by date
   */
  getOffersByDate() {
    const byDate = {};
    this.filteredOffers.forEach(offer => {
      if (!byDate[offer.date]) {
        byDate[offer.date] = [];
      }
      byDate[offer.date].push(offer);
    });
    return byDate;
  },

  /**
   * Get top employers
   * @param {number} limit - Number of employers to return
   * @returns {array} Top employers with counts
   */
  getTopEmployers(limit = 10) {
    const employers = {};
    this.filteredOffers.forEach(o => {
      if (o.company) {
        employers[o.company] = (employers[o.company] || 0) + 1;
      }
    });

    return Object.entries(employers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }));
  },

  /**
   * Get unique values for a field
   * @param {string} field - Field name
   * @returns {array} Unique values
   */
  getUniqueValues(field) {
    const values = new Set();
    this.data.offers.forEach(o => {
      if (o[field]) values.add(o[field]);
    });
    return Array.from(values).sort();
  }
};

// Export for use in other modules
window.DataProcessor = DataProcessor;
