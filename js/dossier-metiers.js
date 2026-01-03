/**
 * Dossier Métiers
 * Job family detail cards
 */

const DossierMetiers = {
  /**
   * Initialize dossier cards
   */
  init() {
    this.update();
  },

  /**
   * Update dossier cards
   */
  update() {
    const container = document.getElementById('dossier-grid');
    if (!container) return;

    const stats = DataProcessor.getStats();

    // Sort families by count
    const families = Object.entries(stats.byJobFamily)
      .sort((a, b) => b[1].count - a[1].count);

    container.innerHTML = families.map(([family, data]) => {
      const info = JobClassifier.getFamily(family);
      const salary = data.salaryStats;
      const employers = this.getTopEmployersForFamily(family);

      return `
        <div class="dossier-card">
          <h4>${info.icon} ${family}</h4>
          <p style="color: var(--color-text-muted); font-size: 14px; margin-bottom: 16px;">${info.description}</p>

          <div class="dossier-stats">
            <div class="dossier-stat">
              <span class="dossier-stat-value">${data.count}</span>
              <span class="dossier-stat-label">Offres</span>
            </div>
            <div class="dossier-stat">
              <span class="dossier-stat-value">${salary ? salary.count : 0}</span>
              <span class="dossier-stat-label">Avec salaire</span>
            </div>
          </div>

          ${salary ? `
            <div class="dossier-salary">
              <h5>Fourchette de salaires (brut annuel)</h5>
              <div class="salary-range">
                <span>${SalaryUtils.formatCurrency(salary.min)}</span>
                <div class="salary-bar"></div>
                <span>${SalaryUtils.formatCurrency(salary.max)}</span>
              </div>
              <p style="text-align: center; margin-top: 8px; font-size: 14px;">
                Médiane: <strong style="color: var(--color-primary);">${SalaryUtils.formatCurrency(salary.median)}</strong>
              </p>
            </div>
          ` : `
            <div class="dossier-salary">
              <p style="color: var(--color-text-muted); font-style: italic;">Données salariales insuffisantes</p>
            </div>
          `}

          ${employers.length > 0 ? `
            <div class="dossier-employers">
              <h5>Principaux recruteurs</h5>
              <div class="employer-tags">
                ${employers.slice(0, 5).map(e => `
                  <span class="employer-tag">${e.name} (${e.count})</span>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <button class="btn btn-cta" data-job-family="${family}">Découvrir la typologie de ces offres (passées)</button>
        </div>
      `;
    }).join('');

    // Add event listeners to CTA buttons
    container.querySelectorAll('.btn-cta[data-job-family]').forEach(btn => {
      btn.addEventListener('click', () => {
        const family = btn.dataset.jobFamily;
        const offers = DataProcessor.getOffers(true).filter(o => o.jobFamily === family);
        OffersModal.show(offers, `Famille: ${family}`);
      });
    });
  },

  /**
   * Get top employers for a specific job family
   */
  getTopEmployersForFamily(family) {
    const offers = DataProcessor.getOffers().filter(o => o.jobFamily === family);
    const employers = {};

    offers.forEach(o => {
      if (o.company) {
        employers[o.company] = (employers[o.company] || 0) + 1;
      }
    });

    return Object.entries(employers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }
};

// Export
window.DossierMetiers = DossierMetiers;
