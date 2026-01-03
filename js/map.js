/**
 * France Map Visualization
 * D3.js choropleth map of France departments
 */

const FranceMap = {
  svg: null,
  projection: null,
  path: null,
  colorScale: null,
  colorMode: 'count', // 'count' or 'salary'
  selectedDepts: [],
  tooltip: null,

  /**
   * Initialize the map
   */
  async init() {
    const container = document.getElementById('france-map');
    if (!container) return;

    // Clear existing content
    container.innerHTML = '';

    // Get dimensions - use CSS-defined height from custom properties
    const width = container.clientWidth;
    const computedStyle = getComputedStyle(document.documentElement);
    const cssHeight = parseInt(computedStyle.getPropertyValue('--map-height-desktop').trim()) || 380;
    const height = Math.min(container.clientHeight || cssHeight, cssHeight);

    // Create SVG
    this.svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    // Create tooltip
    this.tooltip = d3.select('body')
      .append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0);

    // Load GeoJSON
    try {
      const response = await fetch('data/france-topo.json');
      const geojson = await response.json();

      // Set up projection - fitExtent centers the map within padded bounds
      // This ensures France + Corsica are vertically centered
      const padding = 20;
      this.projection = d3.geoMercator()
        .fitExtent(
          [[padding, padding], [width - padding, height - padding]],
          geojson
        );

      this.path = d3.geoPath().projection(this.projection);

      // Draw map
      this.drawMap(geojson);

      // Initial render
      this.update();
    } catch (error) {
      console.error('Error loading map data:', error);
      container.innerHTML = '<p class="loading">Erreur de chargement de la carte</p>';
    }
  },

  /**
   * Draw the map paths
   * @param {object} geojson - GeoJSON data
   */
  drawMap(geojson) {
    // Create a group for the map
    const g = this.svg.append('g').attr('class', 'departments');

    // Draw departments
    g.selectAll('path')
      .data(geojson.features)
      .enter()
      .append('path')
      .attr('d', this.path)
      .attr('class', 'department')
      .attr('data-code', d => d.properties.code)
      .attr('fill', '#e2e8f0')
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .on('mouseover', (event, d) => this.handleMouseOver(event, d))
      .on('mouseout', () => this.handleMouseOut())
      .on('click', (event, d) => this.handleClick(d));
  },

  /**
   * Update map colors based on data
   */
  update() {
    const stats = DataProcessor.getStats();
    const byDept = stats.byDepartment;

    // Determine values for color scale
    let values;
    if (this.colorMode === 'count') {
      values = Object.values(byDept).map(d => d.count);
    } else {
      values = Object.values(byDept)
        .filter(d => d.salaryStats)
        .map(d => d.salaryStats.median);
    }

    const maxVal = Math.max(...values, 1);

    // Create color scale using CEPID brand colors
    // Count: light indigo to primary blue
    // Salary: light amber to dark blue
    this.colorScale = d3.scaleSequential()
      .domain([0, maxVal])
      .interpolator(this.colorMode === 'count'
        ? d3.interpolate('#e0e7ff', '#2563eb')
        : d3.interpolate('#fef3c7', '#1d4ed8'));

    // Update department colors
    const self = this;
    this.svg.selectAll('.department')
      .transition()
      .duration(300)
      .attr('fill', function() {
        const code = this.getAttribute('data-code');
        const deptData = byDept[code];

        if (!deptData) return '#f1f5f9';

        if (self.colorMode === 'count') {
          return self.colorScale(deptData.count);
        } else {
          return deptData.salaryStats
            ? self.colorScale(deptData.salaryStats.median)
            : '#f1f5f9';
        }
      });

    // Update legend
    this.updateLegend(maxVal);
  },

  /**
   * Update the legend
   * @param {number} maxVal - Maximum value for scale
   */
  updateLegend(maxVal) {
    const legend = document.getElementById('map-legend');
    if (!legend) return;

    const title = this.colorMode === 'count' ? 'Nombre d\'offres' : 'Salaire médian';
    const isSalary = this.colorMode === 'salary';
    const formatVal = isSalary
      ? v => v === 0 ? 'NC' : SalaryUtils.formatCurrency(v, true)
      : v => Math.round(v);

    // For salary, start from 0.25 to avoid showing 0/N/A
    const steps = isSalary ? [0.25, 0.5, 0.75, 1] : [0, 0.25, 0.5, 0.75, 1];

    legend.innerHTML = `
      <h4>${title}</h4>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        ${steps.map(p => {
          const val = p * maxVal;
          return `
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 20px; height: 20px; background: ${this.colorScale(val)}; border-radius: 2px;"></div>
              <span style="font-size: 12px;">${formatVal(val)}</span>
            </div>
          `;
        }).join('')}
        ${isSalary ? `
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 20px; height: 20px; background: #f1f5f9; border-radius: 2px; border: 1px solid #e2e8f0;"></div>
            <span style="font-size: 12px;">NC</span>
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * Handle mouse over department
   */
  handleMouseOver(event, d) {
    const code = d.properties.code;
    const name = d.properties.nom;
    const stats = DataProcessor.getStats();
    const deptData = stats.byDepartment[code];

    // Highlight
    d3.select(event.target)
      .attr('stroke', '#1e40af')
      .attr('stroke-width', 2);

    // Show tooltip
    let content = `<strong>${name} (${code})</strong><br>`;
    if (deptData) {
      content += `Offres: ${deptData.count}<br>`;
      if (deptData.salaryStats && deptData.salaryStats.median) {
        content += `Salaire médian: ${SalaryUtils.formatCurrency(deptData.salaryStats.median, true)} (n=${deptData.salaryStats.count})`;
      } else {
        content += `Salaire médian: NC`;
      }
    } else {
      content += 'Aucune offre';
    }

    this.tooltip
      .html(content)
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 28) + 'px')
      .style('opacity', 1);
  },

  /**
   * Handle mouse out
   */
  handleMouseOut() {
    this.svg.selectAll('.department')
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5);

    this.tooltip.style('opacity', 0);
  },

  /**
   * Handle click on department
   */
  handleClick(d) {
    const code = d.properties.code;
    const idx = this.selectedDepts.indexOf(code);

    if (idx >= 0) {
      this.selectedDepts.splice(idx, 1);
    } else if (this.selectedDepts.length < 3) {
      this.selectedDepts.push(code);
    }

    this.updateComparison();
  },

  /**
   * Update comparison cards
   */
  updateComparison() {
    const container = document.getElementById('comparison-cards');
    if (!container) return;

    if (this.selectedDepts.length === 0) {
      container.innerHTML = '<p class="text-muted">Aucun département sélectionné</p>';
      return;
    }

    const stats = DataProcessor.getStats();

    container.innerHTML = this.selectedDepts.map(code => {
      const deptData = stats.byDepartment[code];
      const name = DataProcessor.getData().departments[code] || code;

      if (!deptData) {
        return `
          <div class="comparison-card" style="background: var(--color-surface-alt); border-radius: var(--radius-md); padding: var(--spacing-md);">
            <h4>${name} (${code})</h4>
            <p>Aucune donnée</p>
            <button onclick="FranceMap.removeFromComparison('${code}')" class="btn btn-secondary" style="margin-top: 8px; padding: 4px 8px; font-size: 12px;">Retirer</button>
          </div>
        `;
      }

      return `
        <div class="comparison-card" style="background: var(--color-surface-alt); border-radius: var(--radius-md); padding: var(--spacing-md);">
          <h4 style="margin-bottom: 8px;">${name} (${code})</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px;">
            <div>
              <span style="color: var(--color-text-muted);">Offres</span><br>
              <strong>${deptData.count}</strong>
            </div>
            <div>
              <span style="color: var(--color-text-muted);">Salaire médian</span><br>
              <strong>${deptData.salaryStats && deptData.salaryStats.median ? `${SalaryUtils.formatCurrency(deptData.salaryStats.median, true)} <span class="count-badge">(n=${deptData.salaryStats.count})</span>` : 'NC'}</strong>
            </div>
          </div>
          <button onclick="FranceMap.removeFromComparison('${code}')" class="btn btn-secondary" style="margin-top: 8px; padding: 4px 8px; font-size: 12px;">Retirer</button>
        </div>
      `;
    }).join('');
  },

  /**
   * Remove department from comparison
   */
  removeFromComparison(code) {
    const idx = this.selectedDepts.indexOf(code);
    if (idx >= 0) {
      this.selectedDepts.splice(idx, 1);
      this.updateComparison();
    }
  },

  /**
   * Set color mode
   * @param {string} mode - 'count' or 'salary'
   */
  setColorMode(mode) {
    this.colorMode = mode;
    this.update();
  }
};

// Export
window.FranceMap = FranceMap;
