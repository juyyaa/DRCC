/* ============================================
   DRCC — charts.js
   Chart.js wrappers — reusable across all pages
   ============================================ */

'use strict';

const Charts = {

  /* ---- SHARED DEFAULTS ---- */
  _defaults: {
    fontFamily: 'Inter, -apple-system, sans-serif',
    fontSize:   11,
    gridColor:  'rgba(0,0,0,0.05)',
    tickColor:  '#6C757D',
    tooltipBg:  '#1C2431',
    tooltipTitle:'rgba(255,255,255,1)',
    tooltipBody: 'rgba(255,255,255,0.65)',
    tooltipBorder:'rgba(255,255,255,0.08)',
  },

  /* ---- COPPER GRADIENT helper ---- */
  _copperGradient(ctx, height = 260) {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, 'rgba(181,101,29,0.22)');
    g.addColorStop(1, 'rgba(181,101,29,0)');
    return g;
  },

  /* ---- LINE CHART ---- */
  /**
   * createLine(canvasId, labels, data, opts?)
   * opts: { color, label, height, yMin, yMax, tooltipLabel }
   * Returns Chart instance
   */
  createLine(canvasId, labels, data, opts = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) {
      console.warn(`[Charts] Canvas #${canvasId} not found or Chart.js not loaded`);
      return null;
    }
    const ctx    = canvas.getContext('2d');
    const color  = opts.color || '#B5651D';
    const grad   = this._copperGradient(ctx, opts.height || 260);
    const d      = this._defaults;

    return new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: opts.label || 'Data',
          data,
          borderColor:            color,
          backgroundColor:        opts.fill !== false ? grad : 'transparent',
          fill:                   opts.fill !== false,
          tension:                opts.tension ?? 0.42,
          borderWidth:            2.5,
          pointBackgroundColor:   color,
          pointBorderColor:       '#fff',
          pointBorderWidth:       2.5,
          pointRadius:            opts.pointRadius ?? 5,
          pointHoverRadius:       7,
          pointHoverBorderWidth:  0,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: d.tooltipBg,
            titleColor:      d.tooltipTitle,
            bodyColor:       d.tooltipBody,
            padding:         12,
            borderColor:     d.tooltipBorder,
            borderWidth:     1,
            displayColors:   false,
            callbacks: {
              title: (ctx) => ctx[0].label,
              label: opts.tooltipLabel
                ? opts.tooltipLabel
                : (ctx) => `  ${ctx.parsed.y} ${opts.unit || 'data'}`,
            },
          },
        },
        scales: {
          x: {
            grid:   { display: false },
            border: { display: false },
            ticks:  { color: d.tickColor, font: { family: d.fontFamily, size: d.fontSize }, padding: 6 },
          },
          y: {
            grid:   { color: d.gridColor, lineWidth: 1 },
            border: { display: false },
            ticks:  { color: d.tickColor, font: { family: d.fontFamily, size: d.fontSize }, padding: 8, stepSize: opts.stepSize || undefined },
            min:    opts.yMin ?? 0,
            suggestedMax: opts.yMax ?? (Math.max(...data) + 10),
          },
        },
        animation: { duration: 800, easing: 'easeOutQuart' },
      },
    });
  },

  /* ---- MULTI-LINE CHART ---- */
  /**
   * createMultiLine(canvasId, labels, datasets, opts?)
   * datasets: [{ label, data, color }]
   */
  createMultiLine(canvasId, labels, datasets, opts = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return null;
    const ctx = canvas.getContext('2d');
    const d   = this._defaults;

    return new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: datasets.map((ds, i) => ({
          label:              ds.label,
          data:               ds.data,
          borderColor:        ds.color,
          backgroundColor:    ds.fill ? `${ds.color}22` : 'transparent',
          fill:               !!ds.fill,
          tension:            0.4,
          borderWidth:        ds.borderWidth || 2,
          borderDash:         ds.dashed ? [5, 4] : [],
          pointRadius:        ds.pointRadius ?? 4,
          pointBackgroundColor: ds.color,
          pointBorderColor:   '#fff',
          pointBorderWidth:   2,
          pointHoverRadius:   6,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            display:  opts.legend !== false,
            position: 'bottom',
            labels: { color: d.tickColor, font: { family: d.fontFamily, size: 11 }, boxWidth: 10, padding: 14 },
          },
          tooltip: {
            backgroundColor: d.tooltipBg, titleColor: d.tooltipTitle,
            bodyColor: d.tooltipBody, padding: 11,
            borderColor: d.tooltipBorder, borderWidth: 1,
          },
        },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: d.tickColor, font: { family: d.fontFamily, size: 11 } } },
          y: { grid: { color: d.gridColor }, border: { display: false }, ticks: { color: d.tickColor, font: { family: d.fontFamily, size: 11 } }, min: opts.yMin ?? 0 },
        },
        animation: { duration: 700, easing: 'easeOutQuart' },
      },
    });
  },

  /* ---- DOUGHNUT / PIE ---- */
  /**
   * createDoughnut(canvasId, labels, data, colors, opts?)
   * opts: { cutout, centerLabel, centerValue, legendId }
   * Returns Chart instance
   */
  createDoughnut(canvasId, labels, data, colors, opts = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return null;
    const d     = this._defaults;
    const total = data.reduce((a, b) => a + b, 0);

    // Center text plugin (inline, one-off)
    const centerPlugin = {
      id: `center_${canvasId}`,
      afterDraw(chart) {
        const { ctx, width, height } = chart;
        ctx.save();
        ctx.font = `900 22px ${d.fontFamily}`;
        ctx.fillStyle = '#212529';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(opts.centerValue ?? total, width / 2, height / 2 - 9);
        ctx.font = `600 10px ${d.fontFamily}`;
        ctx.fillStyle = '#6C757D';
        ctx.fillText(opts.centerLabel ?? 'Total', width / 2, height / 2 + 11);
        ctx.restore();
      },
    };

    const chart = new Chart(canvas.getContext('2d'), {
      type:    'doughnut',
      plugins: [centerPlugin],
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth:     0,
          hoverOffset:     8,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: opts.cutout ?? '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: d.tooltipBg, titleColor: d.tooltipTitle,
            bodyColor: d.tooltipBody, padding: 11,
            borderColor: d.tooltipBorder, borderWidth: 1,
            callbacks: {
              label: (ctx) => `  ${ctx.label}: ${ctx.parsed} (${((ctx.parsed / total) * 100).toFixed(1)}%)`,
            },
          },
        },
        animation: { duration: 900, easing: 'easeOutQuart' },
      },
    });

    // Auto-build legend if legendId provided
    if (opts.legendId) {
      this.buildDoughnutLegend(opts.legendId, labels, data, colors, total);
    }

    return chart;
  },

  /* ---- BAR CHART ---- */
  /**
   * createBar(canvasId, labels, data, opts?)
   * opts: { colors (array or single), horizontal, label, unit }
   */
  createBar(canvasId, labels, data, opts = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return null;
    const d      = this._defaults;
    const colors = Array.isArray(opts.colors)
      ? opts.colors
      : Array(data.length).fill(opts.color || '#B5651D');

    return new Chart(canvas.getContext('2d'), {
      type: opts.horizontal ? 'bar' : 'bar',
      data: {
        labels,
        datasets: [{
          label:           opts.label || 'Data',
          data,
          backgroundColor: colors.map(c => c + 'CC'),
          borderColor:     colors,
          borderWidth:     0,
          borderRadius:    opts.radius ?? 5,
          borderSkipped:   false,
        }],
      },
      options: {
        indexAxis:  opts.horizontal ? 'y' : 'x',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: d.tooltipBg, titleColor: d.tooltipTitle,
            bodyColor: d.tooltipBody, padding: 11,
            borderColor: d.tooltipBorder, borderWidth: 1, displayColors: false,
            callbacks: {
              label: (ctx) => `  ${ctx.parsed[opts.horizontal ? 'x' : 'y']} ${opts.unit || ''}`,
            },
          },
        },
        scales: {
          x: {
            grid: opts.horizontal ? { color: d.gridColor } : { display: false },
            border: { display: false },
            ticks: { color: d.tickColor, font: { family: d.fontFamily, size: 11 } },
          },
          y: {
            grid: opts.horizontal ? { display: false } : { color: d.gridColor },
            border: { display: false },
            ticks: { color: d.tickColor, font: { family: d.fontFamily, size: 11 } },
            min: 0,
          },
        },
        animation: { duration: 700, easing: 'easeOutQuart' },
      },
    });
  },

  /* ---- DOUGHNUT LEGEND BUILDER (standalone) ---- */
  buildDoughnutLegend(legendId, labels, data, colors, total) {
    const el = document.getElementById(legendId);
    if (!el) return;
    el.innerHTML = labels.map((label, i) => `
      <div class="legend-item">
        <span class="legend-dot" style="background:${colors[i]}"></span>
        <span class="legend-label">${label}</span>
        <span class="legend-value">${data[i]}</span>
        <span class="legend-pct">${((data[i] / total) * 100).toFixed(0)}%</span>
      </div>`).join('');
  },

  /* ---- UPDATE helpers ---- */
  updateData(chart, newData, newLabels) {
    if (!chart) return;
    if (newLabels) chart.data.labels = newLabels;
    chart.data.datasets[0].data = newData;
    chart.update('active');
  },

  destroy(chart) {
    if (chart) chart.destroy();
    return null;
  },
};

window.Charts = Charts;
