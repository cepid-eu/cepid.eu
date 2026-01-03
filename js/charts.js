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
   * Salary by Contract Type Chart
   */
  createSalaryContractChart() {
    const ctx = document.getElementById('chart-salary-contract');
    if (!ctx) return;

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
              }
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
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);

    this.instances.salaryContract.data.labels = data.map(d => d.name);
    this.instances.salaryContract.data.datasets[0].data = data.map(d => d.value);
    this.instances.salaryContract.data.datasets[0].counts = data.map(d => d.count);
    this.instances.salaryContract.data.datasets[0].label = SalaryUtils.getLabel(this.salaryType, this.salaryPeriod);
    this.instances.salaryContract.update();
  },

  /**
   * Salary by Job Family Chart
   */
  createSalaryFamilyChart() {
    const ctx = document.getElementById('chart-salary-family');
    if (!ctx) return;

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
      .sort((a, b) => b.value - a.value);

    this.instances.salaryFamily.data.labels = data.map(d => d.name);
    this.instances.salaryFamily.data.datasets[0].data = data.map(d => d.value);
    this.instances.salaryFamily.data.datasets[0].counts = data.map(d => d.count);
    this.instances.salaryFamily.data.datasets[0].backgroundColor = data.map(d => d.color);
    this.instances.salaryFamily.data.datasets[0].label = SalaryUtils.getLabel(this.salaryType, this.salaryPeriod);
    this.instances.salaryFamily.update();
  },

  /**
   * Salary by Department Chart
   */
  createSalaryDeptChart() {
    const ctx = document.getElementById('chart-salary-dept');
    if (!ctx) return;

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
      .slice(0, 15);

    this.instances.salaryDept.data.labels = data.map(d => d.name);
    this.instances.salaryDept.data.datasets[0].data = data.map(d => d.value);
    this.instances.salaryDept.data.datasets[0].counts = data.map(d => d.count);
    this.instances.salaryDept.data.datasets[0].label = SalaryUtils.getLabel(this.salaryType, this.salaryPeriod);
    this.instances.salaryDept.update();
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
