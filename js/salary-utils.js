/**
 * Salary Utilities
 * Handles gross/net and annual/monthly conversions
 */

const SalaryUtils = {
  // Conversion rates
  RATES: {
    cadre: 0.75,      // 25% social charges for cadre
    nonCadre: 0.78    // 22% social charges for non-cadre
  },

  /**
   * Format a number as French currency
   * @param {number} value - The value to format
   * @returns {string} Formatted currency string
   */
  formatCurrency(value, showNA = false) {
    if (value === null || value === undefined || value === 0) {
      return showNA ? 'NC' : 'Non renseigné';
    }
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(value);
  },

  /**
   * Format number with French locale
   * @param {number} value - The value to format
   * @returns {string} Formatted number string
   */
  formatNumber(value) {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('fr-FR').format(value);
  },

  /**
   * Get salary value based on current display settings
   * @param {object} offer - The offer object with salary data
   * @param {string} type - 'gross' or 'net'
   * @param {string} period - 'annual' or 'monthly'
   * @returns {number|null} The salary value
   */
  getSalary(offer, type = 'gross', period = 'annual') {
    if (!offer) return null;

    const key = `salary${type.charAt(0).toUpperCase() + type.slice(1)}${period.charAt(0).toUpperCase() + period.slice(1)}`;
    return offer[key] || null;
  },

  /**
   * Get display label for salary type/period combination
   * @param {string} type - 'gross' or 'net'
   * @param {string} period - 'annual' or 'monthly'
   * @returns {string} Display label
   */
  getLabel(type, period) {
    const typeLabels = { gross: 'Brut', net: 'Net' };
    const periodLabels = { annual: 'annuel', monthly: 'mensuel' };
    return `${typeLabels[type]} ${periodLabels[period]}`;
  },

  /**
   * Convert gross to net
   * @param {number} gross - Gross salary
   * @param {boolean} isCadre - Whether the position is cadre
   * @returns {number} Net salary
   */
  grossToNet(gross, isCadre = false) {
    if (gross === null || gross === undefined) return null;
    const rate = isCadre ? this.RATES.cadre : this.RATES.nonCadre;
    return Math.round(gross * rate);
  },

  /**
   * Convert net to gross
   * @param {number} net - Net salary
   * @param {boolean} isCadre - Whether the position is cadre
   * @returns {number} Gross salary
   */
  netToGross(net, isCadre = false) {
    if (net === null || net === undefined) return null;
    const rate = isCadre ? this.RATES.cadre : this.RATES.nonCadre;
    return Math.round(net / rate);
  },

  /**
   * Convert annual to monthly
   * @param {number} annual - Annual salary
   * @param {number} months - Number of months (default 12)
   * @returns {number} Monthly salary
   */
  annualToMonthly(annual, months = 12) {
    if (annual === null || annual === undefined) return null;
    return Math.round(annual / months);
  },

  /**
   * Convert monthly to annual
   * @param {number} monthly - Monthly salary
   * @param {number} months - Number of months (default 12)
   * @returns {number} Annual salary
   */
  monthlyToAnnual(monthly, months = 12) {
    if (monthly === null || monthly === undefined) return null;
    return Math.round(monthly * months);
  },

  /**
   * Calculate salary statistics for an array of values
   * @param {number[]} salaries - Array of salary values
   * @returns {object} Statistics object
   */
  calculateStats(salaries) {
    const valid = salaries.filter(s => s !== null && s !== undefined && !isNaN(s));
    if (valid.length === 0) return null;

    const sorted = valid.sort((a, b) => a - b);
    const len = sorted.length;

    return {
      count: len,
      min: sorted[0],
      max: sorted[len - 1],
      median: len % 2 === 0
        ? (sorted[len / 2 - 1] + sorted[len / 2]) / 2
        : sorted[Math.floor(len / 2)],
      q1: sorted[Math.floor(len * 0.25)],
      q3: sorted[Math.floor(len * 0.75)],
      mean: valid.reduce((a, b) => a + b, 0) / len
    };
  }
};

// Export for use in other modules
window.SalaryUtils = SalaryUtils;
