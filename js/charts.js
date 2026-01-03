/**
 * Chart Visualizations
 * Chart.js based charts for the dashboard
 */

const Charts = {
  instances: {},
  salaryType: 'gross',
  salaryPeriod: 'annual',

  /**
   * Initialize all charts
   */
  init() {
    this.createJobFamilyChart();
    this.createContractChart();
    this.createSalaryContractChart();
    this.createSalaryFamilyChart();
    this.createSalaryDeptChart();
  },

  /**
   * Update all charts
   */
  update() {
    const stats = DataProcessor.getStats();

    this.updateJobFamilyChart(stats);
    this.updateContractChart(stats);
    this.updateSalaryContractChart(stats);
    this.updateSalaryFamilyChart(stats);
    this.updateSalaryDeptChart(stats);
    this.updateSalaryTable(stats);
  },

  /**
   * Destroy a chart if it exists
   */
  destroyChart(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  },

  /**
   * Job Family Distribution Chart
   */
  createJobFamilyChart() {
    const ctx = document.getElementById('chart-job-families');
    if (!ctx) return;

    this.destroyChart('jobFamilies');

    this.instances.jobFamilies = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: JobClassifier.getColorPalette()
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'right',
            labels: { boxWidth: 12, font: { size: 11 } }
          }
        }
      }
    });
  },

  updateJobFamilyChart(stats) {
    if (!this.instances.jobFamilies) return;

    const data = Object.entries(stats.byJobFamily)
      .sort((a, b) => b[1].count - a[1].count);

    this.instances.jobFamilies.data.labels = data.map(d => d[0]);
    this.instances.jobFamilies.data.datasets[0].data = data.map(d => d[1].count);
    this.instances.jobFamilies.data.datasets[0].backgroundColor = data.map(d => JobClassifier.getColor(d[0]));
    this.instances.jobFamilies.update();
  },

  /**
   * Contract Type Chart
   */
  createContractChart() {
    const ctx = document.getElementById('chart-contracts');
    if (!ctx) return;

    this.destroyChart('contracts');

    this.instances.contracts = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'right',
            labels: { boxWidth: 12, font: { size: 11 } }
          }
        }
      }
    });
  },

  updateContractChart(stats) {
    if (!this.instances.contracts) return;

    const data = Object.entries(stats.byContractType)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6);

    this.instances.contracts.data.labels = data.map(d => d[0]);
    this.instances.contracts.data.datasets[0].data = data.map(d => d[1].count);
    this.instances.contracts.update();
  },

  /**
   * Helper: Ensure canvas has a wrapper for scrolling/sizing
   */
  ensureWrapper(canvas) {
    if (canvas.parentNode.classList.contains('chart-scroll-wrapper')) {
      return canvas.parentNode;
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'chart-scroll-wrapper';
    wrapper.style.position = 'relative';
    wrapper.style.width = '100%';
    canvas.parentNode.insertBefore(wrapper, canvas);
    wrapper.appendChild(canvas);
    return wrapper;
  },

  /**
   * Salary by Contract Type Chart
   */
  createSalaryContractChart() {
    const canvas = document.getElementById('chart-salary-contract');
    if (!canvas) return;

    // Ensure wrapper exists
    this.ensureWrapper(canvas);
    const ctx = canvas.getContext('2d');

    this.destroyChart('salaryContract');

    this.instances.salaryContract = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: 'Salaire médian',
          data: [],
          counts: [],
          backgroundColor: '#2563eb'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const count = ctx.dataset.counts?.[ctx.dataIndex];
                return `${SalaryUtils.formatCurrency(ctx.raw)} (n=${count || 0})`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              callback: v => SalaryUtils.formatCurrency(v)
            }
          },
          y: {
            border: {
              display: true,
              color: '#cbd5e1',
              width: 2
            },
            grid: {
              display: false
            },
            ticks: {
              autoSkip: false,
              font: {
                size: 11
              },
              crossAlign: 'near', // Left-align labels
              padding: 10
            }
          }
        }
      }
    });
  },

  updateSalaryContractChart(stats) {
    if (!this.instances.salaryContract) return;

    const salaryKey = this.getSalaryKey();
    const data = Object.entries(stats.byContractType)
      .filter(d => d[1].salaryStats)
      .map(([name, d]) => ({
        name,
        value: this.convertSalary(d.salaryStats.median),
        count: d.salaryStats.count
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

    // Dynamic Height Calculation
    const ctx = this.instances.salaryContract.ctx;
    const canvas = ctx.canvas;
    const wrapper = canvas.parentNode; // Should be .chart-scroll-wrapper

    const barHeight = 60; // Increased to 60px per bar to prevent label overlap
    const minHeight = 200;
    const newHeight = Math.max(minHeight, data.length * barHeight);

    console.log('[Charts:Debug] updateSalaryContractChart called', {
      dataLength: data.length,
      newHeight: newHeight,
      currentWrapperHeight: wrapper.style.height
    });

    // Resize wrapper, NOT canvas directly (breaks loop)
    wrapper.style.height = `${newHeight}px`;
    // Canvas should fill wrapper
    canvas.style.height = '100%';
    canvas.style.maxHeight = 'none';

    this.instances.salaryContract.data.labels = data.map(d => d.name);
    this.instances.salaryContract.data.datasets[0].data = data.map(d => d.value);
    this.instances.salaryContract.data.datasets[0].counts = data.map(d => d.count);
    this.instances.salaryContract.data.datasets[0].label = SalaryUtils.getLabel(this.salaryType, this.salaryPeriod);
    this.instances.salaryContract.update();
    // this.instances.salaryContract.resize(); // Disabled to prevent loop
  },

  /**
   * Salary by Job Family Chart
   */
  createSalaryFamilyChart() {
    const canvas = document.getElementById('chart-salary-family');
    if (!canvas) return;

    this.ensureWrapper(canvas);
    const ctx = canvas.getContext('2d');

    this.destroyChart('salaryFamily');

    this.instances.salaryFamily = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: 'Salaire médian',
          data: [],
          counts: [],
          backgroundColor: []
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const count = ctx.dataset.counts?.[ctx.dataIndex];
                return `${SalaryUtils.formatCurrency(ctx.raw)} (n=${count || 0})`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              callback: v => SalaryUtils.formatCurrency(v)
            }
          },
          y: {
            border: {
              display: true,
              color: '#cbd5e1',
              width: 2
            },
            grid: {
              display: false
            },
            ticks: {
              autoSkip: false,
              crossAlign: 'near' // Left-align labels
            }
          }
        }
      }
    });
  },

  updateSalaryFamilyChart(stats) {
    if (!this.instances.salaryFamily) return;

    const data = Object.entries(stats.byJobFamily)
      .filter(d => d[1].salaryStats)
      .map(([name, d]) => ({
        name,
        value: this.convertSalary(d.salaryStats.median),
        count: d.salaryStats.count,
        color: JobClassifier.getColor(name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

    // Dynamic Height Calculation
    const ctx = this.instances.salaryFamily.ctx;
    const canvas = ctx.canvas;
    const wrapper = canvas.parentNode;

    const barHeight = 60; // Increased to 60px per bar
    const minHeight = 200;
    const newHeight = Math.max(minHeight, data.length * barHeight);

    wrapper.style.height = `${newHeight}px`;
    canvas.style.height = '100%';
    canvas.style.maxHeight = 'none';

    this.instances.salaryFamily.data.labels = data.map(d => d.name);
    this.instances.salaryFamily.data.datasets[0].data = data.map(d => d.value);
    this.instances.salaryFamily.data.datasets[0].counts = data.map(d => d.count);
    this.instances.salaryFamily.data.datasets[0].backgroundColor = data.map(d => d.color);
    this.instances.salaryFamily.data.datasets[0].label = SalaryUtils.getLabel(this.salaryType, this.salaryPeriod);
    this.instances.salaryFamily.update();
    // this.instances.salaryFamily.resize();
  },

  /**
   * Salary by Department Chart
   */
  createSalaryDeptChart() {
    const canvas = document.getElementById('chart-salary-dept');
    if (!canvas) return;

    this.ensureWrapper(canvas);
    const ctx = canvas.getContext('2d');

    this.destroyChart('salaryDept');

    this.instances.salaryDept = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: 'Salaire médian',
          data: [],
          counts: [],
          backgroundColor: '#10b981'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const count = ctx.dataset.counts?.[ctx.dataIndex];
                return `${SalaryUtils.formatCurrency(ctx.raw)} (n=${count || 0})`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              callback: v => SalaryUtils.formatCurrency(v)
            }
          },
          y: {
            border: {
              display: true,
              color: '#cbd5e1',
              width: 2
            },
            grid: {
              display: false
            },
            ticks: {
              autoSkip: false,
              crossAlign: 'near'
            }
          }
        }
      }
    });
  },

  updateSalaryDeptChart(stats) {
    if (!this.instances.salaryDept) return;

    const data = Object.entries(stats.byDepartment)
      .filter(d => d[1].salaryStats)
      .map(([code, d]) => ({
        name: `${d.name} (${code})`,
        value: this.convertSalary(d.salaryStats.median),
        count: d.salaryStats.count
      }))
      .sort((a, b) => b.value - a.value)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

    // Dynamic Height Calculation
    const ctx = this.instances.salaryDept.ctx;
    const canvas = ctx.canvas;
    const wrapper = canvas.parentNode;

    const barHeight = 60; // Increased to 60px per bar
    const minHeight = 200;
    const newHeight = Math.max(minHeight, data.length * barHeight);

    wrapper.style.height = `${newHeight}px`;
    canvas.style.height = '100%';
    canvas.style.maxHeight = 'none';

    this.instances.salaryDept.data.labels = data.map(d => d.name);
    this.instances.salaryDept.data.datasets[0].data = data.map(d => d.value);
    this.instances.salaryDept.data.datasets[0].counts = data.map(d => d.count);
    this.instances.salaryDept.data.datasets[0].label = SalaryUtils.getLabel(this.salaryType, this.salaryPeriod);
    this.instances.salaryDept.update();
    // this.instances.salaryDept.resize();
  },

  /**
   * Update salary summary table
   */
  updateSalaryTable(stats) {
    const tbody = document.querySelector('#salary-summary-table tbody');
    if (!tbody) return;

    const data = Object.entries(stats.byJobFamily)
      .sort((a, b) => b[1].count - a[1].count);

    tbody.innerHTML = data.map(([family, d]) => {
      const s = d.salaryStats;
      return `
        <tr>
          <td><span style="color: ${JobClassifier.getColor(family)};">●</span> ${family}</td>
          <td>${d.count}</td>
          <td>${s ? s.count : 0}</td>
          <td>${s ? SalaryUtils.formatCurrency(this.convertSalary(s.min)) : '-'}</td>
          <td><strong>${s ? SalaryUtils.formatCurrency(this.convertSalary(s.median)) : '-'}</strong>${s ? ` <span class="count-badge">(n=${s.count})</span>` : ''}</td>
          <td>${s ? SalaryUtils.formatCurrency(this.convertSalary(s.max)) : '-'}</td>
        </tr>
      `;
    }).join('');
  },

  /**
   * Convert salary based on current display settings
   */
  convertSalary(value) {
    if (!value) return null;

    let result = value;

    // Convert gross to net if needed
    if (this.salaryType === 'net') {
      result = SalaryUtils.grossToNet(result);
    }

    // Convert annual to monthly if needed
    if (this.salaryPeriod === 'monthly') {
      result = SalaryUtils.annualToMonthly(result);
    }

    return result;
  },

  /**
   * Get the current salary key
   */
  getSalaryKey() {
    return `salary${this.salaryType.charAt(0).toUpperCase() + this.salaryType.slice(1)}${this.salaryPeriod.charAt(0).toUpperCase() + this.salaryPeriod.slice(1)}`;
  },

  /**
   * Set salary display type
   */
  setSalaryType(type) {
    this.salaryType = type;
    this.update();
  },

  /**
   * Set salary display period
   */
  setSalaryPeriod(period) {
    this.salaryPeriod = period;
    this.update();
  }
};

// Export
window.Charts = Charts;
