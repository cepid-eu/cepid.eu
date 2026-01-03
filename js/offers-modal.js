/**
 * Offers Modal Component
 * Displays a list of job offers in a modal overlay
 */

const OffersModal = {
  modal: null,
  currentOffers: [],
  currentPage: 1,
  perPage: 20,
  context: '',
  sortColumn: null,
  sortDirection: 'asc',
  // Infinite scroll properties for mobile
  loadedCount: 0,
  loadItemsPerScroll: 20,
  isLoading: false,
  scrollHandler: null,

  /**
   * Check if we're in mobile view
   */
  isMobile() {
    return window.innerWidth < 768;
  },

  /**
   * Initialize the modal (create DOM elements)
   */
  init() {
    if (this.modal) return;

    const modalHTML = `
      <div id="offers-modal" class="offers-modal-overlay" style="display: none;">
        <div class="offers-modal-content">
          <div class="offers-modal-header">
            <div>
              <h2>Offres correspondantes <span class="offers-modal-count"></span></h2>
              <span class="offers-modal-context"></span>
            </div>
            <button class="offers-modal-close" aria-label="Fermer">&times;</button>
          </div>
          <div class="offers-modal-body">
            <div class="offers-modal-stats"></div>
            <div class="offers-table-container">
              <table class="offers-table">
                <thead>
                  <tr>
                    <th class="sortable" data-sort="title">Poste <span class="sort-icon"></span></th>
                    <th class="sortable" data-sort="company">Entreprise <span class="sort-icon"></span></th>
                    <th class="sortable" data-sort="department">Lieu <span class="sort-icon"></span></th>
                    <th class="sortable" data-sort="contractType">Contrat <span class="sort-icon"></span></th>
                    <th class="sortable" data-sort="salaryNetMonthly">Salaire <span class="sort-icon"></span></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
            </div>
            <div class="offers-modal-pagination"></div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('offers-modal');

    // Event listeners
    this.modal.querySelector('.offers-modal-close').addEventListener('click', () => this.hide());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.hide();
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.style.display !== 'none') {
        this.hide();
      }
    });

    // Sort click handlers
    this.modal.querySelectorAll('.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const column = th.dataset.sort;
        this.toggleSort(column);
      });
    });
  },

  /**
   * Toggle sort on a column
   */
  toggleSort(column) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.sortOffers();
    this.currentPage = 1;
    this.renderTable();
    this.renderPagination();
    this.updateSortIcons();
  },

  /**
   * Sort offers by current column
   */
  sortOffers() {
    if (!this.sortColumn) return;

    const col = this.sortColumn;
    const dir = this.sortDirection === 'asc' ? 1 : -1;

    this.currentOffers.sort((a, b) => {
      let valA = a[col];
      let valB = b[col];

      // Handle null/undefined
      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      // Numeric comparison for salary
      if (col === 'salaryNetMonthly') {
        return (valA - valB) * dir;
      }

      // String comparison for others
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
      return valA.localeCompare(valB, 'fr') * dir;
    });
  },

  /**
   * Update sort icons in headers
   */
  updateSortIcons() {
    this.modal.querySelectorAll('.sortable').forEach(th => {
      const icon = th.querySelector('.sort-icon');
      if (th.dataset.sort === this.sortColumn) {
        icon.textContent = this.sortDirection === 'asc' ? ' ▲' : ' ▼';
        th.classList.add('sorted');
      } else {
        icon.textContent = ' ⇅';
        th.classList.remove('sorted');
      }
    });
  },

  /**
   * Setup infinite scroll for mobile
   */
  setupInfiniteScroll() {
    if (!this.isMobile()) return;

    const container = this.modal.querySelector('.offers-table-container');

    // Remove existing scroll handler if any
    if (this.scrollHandler) {
      container.removeEventListener('scroll', this.scrollHandler);
    }

    this.scrollHandler = () => {
      if (this.isLoading) return;
      if (this.loadedCount >= this.currentOffers.length) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollTop + clientHeight >= scrollHeight - 100) {
        this.loadMoreItems();
      }
    };

    container.addEventListener('scroll', this.scrollHandler);
  },

  /**
   * Load more items for infinite scroll
   */
  loadMoreItems() {
    if (this.loadedCount >= this.currentOffers.length) return;

    this.isLoading = true;
    this.showLoadingIndicator();

    // Small delay for visual feedback
    setTimeout(() => {
      const tbody = this.modal.querySelector('.offers-table tbody');
      const start = this.loadedCount;
      const end = Math.min(start + this.loadItemsPerScroll, this.currentOffers.length);
      const newOffers = this.currentOffers.slice(start, end);

      tbody.insertAdjacentHTML('beforeend', this.renderOfferRows(newOffers));
      this.loadedCount = end;
      this.isLoading = false;
      this.hideLoadingIndicator();
      this.updateLoadedCount();
    }, 150);
  },

  /**
   * Render offer rows HTML
   * @param {Array} offers - Array of offer objects
   * @returns {string} HTML string of table rows
   */
  renderOfferRows(offers) {
    const isMobile = this.isMobile();

    return offers.map(offer => {
      const salary = offer.salaryNetMonthly
        ? SalaryUtils.formatCurrency(offer.salaryNetMonthly) + '/mois'
        : '-';

      const company = offer.company || '-';

      const location = isMobile
        ? (offer.department || '-')
        : (offer.departmentName
          ? `${offer.departmentName} (${offer.department})`
          : (offer.department || '-'));

      const url = offer.url || '#';

      const titleContent = isMobile
        ? `<span class="offer-family-badge" style="background: ${JobClassifier.getColor(offer.jobFamily)}20; color: ${JobClassifier.getColor(offer.jobFamily)};">
            ${offer.jobFamily}
           </span>`
        : `<span class="offer-family-badge" style="background: ${JobClassifier.getColor(offer.jobFamily)}20; color: ${JobClassifier.getColor(offer.jobFamily)};">
            ${offer.jobFamily}
           </span>
           <span title="${this.escapeHtml(offer.title)}">${this.truncate(offer.title, 50)}</span>`;

      return `
        <tr>
          <td class="offer-title">
            ${titleContent}
          </td>
          <td>${this.escapeHtml(company)}</td>
          <td>${location}</td>
          <td><span class="contract-badge">${this.escapeHtml(offer.contractType || '-')}</span></td>
          <td>${salary}</td>
          <td>
            ${url !== '#' ? `<a href="${url}" target="_blank" rel="noopener" class="offer-link">Voir</a>` : ''}
          </td>
        </tr>
      `;
    }).join('');
  },

  /**
   * Show loading indicator at bottom of list
   */
  showLoadingIndicator() {
    let indicator = this.modal.querySelector('.infinite-scroll-loading');
    if (!indicator) {
      const container = this.modal.querySelector('.offers-table-container');
      container.insertAdjacentHTML('beforeend', `
        <div class="infinite-scroll-loading">
          <span class="loading-spinner"></span>
          Chargement...
        </div>
      `);
    }
  },

  /**
   * Hide loading indicator
   */
  hideLoadingIndicator() {
    const indicator = this.modal.querySelector('.infinite-scroll-loading');
    if (indicator) {
      indicator.remove();
    }
  },

  /**
   * Update loaded count display on mobile
   */
  updateLoadedCount() {
    const countEl = this.modal.querySelector('.loaded-count');
    if (countEl) {
      countEl.textContent = `${this.loadedCount} / ${this.currentOffers.length}`;
    }
  },

  /**
   * Show the modal with offers
   * @param {Array} offers - Array of offer objects
   * @param {string} context - Context label (e.g., "Famille: Archiviste")
   */
  show(offers, context = '') {
    this.init();
    this.currentOffers = [...offers]; // Clone to avoid mutating original
    this.currentPage = 1;
    this.loadedCount = 0; // Reset for infinite scroll
    this.isLoading = false;
    this.context = context;
    this.sortColumn = null;
    this.sortDirection = 'asc';

    // Update context
    this.modal.querySelector('.offers-modal-context').textContent = context;

    // Update total count in header (INV8: Modal count visibility)
    const totalCount = offers.length.toLocaleString('fr-FR');
    this.modal.querySelector('.offers-modal-count').textContent = `(${totalCount})`;

    // Update stats
    const withSalary = offers.filter(o => o.salaryNetMonthly).length;
    const isMobile = this.isMobile();

    if (isMobile) {
      // Mobile: show loaded count indicator
      this.modal.querySelector('.offers-modal-stats').innerHTML = `
        <span><strong>${offers.length}</strong> offres</span>
        <span><strong>${withSalary}</strong> avec salaire</span>
        <span class="loaded-count"></span>
      `;
    } else {
      this.modal.querySelector('.offers-modal-stats').innerHTML = `
        <span><strong>${offers.length}</strong> offres</span>
        <span><strong>${withSalary}</strong> avec salaire</span>
      `;
    }

    // Render table and pagination
    this.renderTable();
    this.renderPagination();
    this.updateSortIcons();

    // Setup infinite scroll for mobile
    if (isMobile) {
      this.setupInfiniteScroll();
      this.updateLoadedCount();
    }

    // Show modal
    this.modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  },

  /**
   * Hide the modal
   */
  hide() {
    if (this.modal) {
      this.modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  },

  /**
   * Render the offers table
   */
  renderTable() {
    const tbody = this.modal.querySelector('.offers-table tbody');
    const isMobile = this.isMobile();

    let offersToRender;
    if (isMobile) {
      // Mobile: infinite scroll - load first batch
      const end = Math.min(this.loadItemsPerScroll, this.currentOffers.length);
      offersToRender = this.currentOffers.slice(0, end);
      this.loadedCount = end;
    } else {
      // Desktop: pagination
      const start = (this.currentPage - 1) * this.perPage;
      const end = start + this.perPage;
      offersToRender = this.currentOffers.slice(start, end);
    }

    if (offersToRender.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2rem; color: var(--color-text-muted);">
            Aucune offre correspondante
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.renderOfferRows(offersToRender);
  },

  /**
   * Render pagination controls
   */
  renderPagination() {
    const pagination = this.modal.querySelector('.offers-modal-pagination');

    // Hide pagination on mobile (using infinite scroll instead)
    if (this.isMobile()) {
      pagination.innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(this.currentOffers.length / this.perPage);

    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }

    let html = '<div class="pagination-controls">';

    // Previous button
    html += `<button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} data-page="${this.currentPage - 1}">&laquo; Préc.</button>`;

    // Page numbers
    const maxVisible = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
      html += `<button class="pagination-btn" data-page="1">1</button>`;
      if (startPage > 2) html += '<span class="pagination-ellipsis">...</span>';
    }

    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) html += '<span class="pagination-ellipsis">...</span>';
      html += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    // Next button
    html += `<button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} data-page="${this.currentPage + 1}">Suiv. &raquo;</button>`;

    html += '</div>';
    pagination.innerHTML = html;

    // Add click handlers
    pagination.querySelectorAll('.pagination-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page);
        if (page && page !== this.currentPage && page >= 1 && page <= totalPages) {
          this.currentPage = page;
          this.renderTable();
          this.renderPagination();
          // Scroll to top of table
          this.modal.querySelector('.offers-table-container').scrollTop = 0;
        }
      });
    });
  },

  /**
   * Truncate text to max length
   */
  truncate(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  },

  /**
   * Escape HTML entities
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Export
window.OffersModal = OffersModal;
