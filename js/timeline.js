/**
 * Timeline Visualization
 * Shows offer evolution over time
 */

const Timeline = {
  chart: null,

  /**
   * Initialize timeline chart
   */
  init() {
    const ctx = document.getElementById('chart-timeline');
    if (!ctx) return;

    if (this.chart) {
      this.chart.destroy();
    }

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Nombre d\'offres',
          data: [],
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: ctx => {
                const date = new Date(ctx[0].label);
                return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              callback: function(value, index) {
                const date = new Date(this.getLabelForValue(value));
                return date.toLocaleDateString('fr-FR', { month: 'short' });
              },
              maxTicksLimit: 12
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        }
      }
    });

    this.update();
  },

  /**
   * Update timeline with current data
   */
  update() {
    if (!this.chart) return;

    const data = DataProcessor.getData();
    if (!data) return;

    const offersByDate = DataProcessor.getOffersByDate();

    // Get all dates and count offers
    const dates = data.dates.sort();
    const counts = dates.map(date => {
      const offers = offersByDate[date] || [];
      return offers.length;
    });

    this.chart.data.labels = dates;
    this.chart.data.datasets[0].data = counts;
    this.chart.update();
  }
};

// Export
window.Timeline = Timeline;
