/* ============================================
   DRCC — dashboard.js
   Dashboard Utama: Charts, Stats, Alerts, Resources, AI
   ============================================ */

'use strict';

let _trendChart   = null;
let _typeChart    = null;
let _liveTimer    = null;
let _activePeriod = '7d';
let _alertCount   = 0;
const MAX_ALERTS  = 14;

/* ============================================================
   INIT
   ============================================================ */
function initDashboard() {
  const session = buildAppShell('dashboard', 'Dashboard', 'Ringkasan sistem komando nasional');
  if (!session) return;

  renderStats();
  initTrendChart();
  initTypeChart();
  renderAlerts();
  renderResources();
  renderAIAgents();
  initRegionsTable();
  startLiveSimulation();
  updateLastUpdated();
  setInterval(updateLastUpdated, 60000);
}

/* ============================================================
   STAT CARDS — animated counters
   ============================================================ */
function renderStats() {
  const stats = MockData.getStats();

  buildStatCard('sc-incidents', stats.incidents, 'Insiden Aktif',   'fa-triangle-exclamation', 'danger',  'incidents.html');
  buildStatCard('sc-affected',  stats.affected,  'Warga Terdampak', 'fa-people-group',         'warning', 'map.html');
  buildStatCard('sc-shelters',  stats.shelters,  'Posko Aktif',     'fa-house-flag',            'info',    'map.html');
  buildStatCard('sc-personnel', stats.personnel, 'Tim Respons',     'fa-user-group',            'success', 'resources.html');
}

function buildStatCard(id, stat, label, icon, colorClass, link) {
  const el = document.getElementById(id);
  if (!el) return;

  const trendIcon = stat.trend === 'up' ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
  const trendClass = stat.trend === 'up' ? 'up' : 'down';

  el.style.cursor = 'pointer';
  el.onclick = () => { window.location.href = link; };
  el.title = `Lihat detail`;

  el.innerHTML = `
    <div class="stat-icon ${colorClass}"><i class="fas ${icon}"></i></div>
    <div class="stat-content">
      <div class="stat-value" id="${id}-val">0</div>
      <div class="stat-label">${label}</div>
      <div class="stat-change ${trendClass}">
        <i class="fas ${trendIcon}"></i> ${stat.changeText}
      </div>
    </div>
    <a href="${link}" class="stat-link-arrow" title="Lihat detail" onclick="event.stopPropagation()">
      <i class="fas fa-arrow-right"></i>
    </a>`;

  animateCounter(document.getElementById(`${id}-val`), stat.value, 1400, v => formatNumber(v));
}

function animateCounter(el, target, duration, formatter) {
  if (!el) return;
  const start = performance.now();
  const step  = (now) => {
    const t = Math.min((now - start) / duration, 1);
    // ease-out cubic
    const eased   = 1 - Math.pow(1 - t, 3);
    const current = Math.floor(eased * target);
    el.textContent = formatter ? formatter(current) : current.toLocaleString('id-ID');
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = formatter ? formatter(target) : target.toLocaleString('id-ID');
  };
  requestAnimationFrame(step);
}

/* ============================================================
   TREND CHART — Chart.js line
   ============================================================ */
function initTrendChart() {
  const canvas = document.getElementById('chart-trend');
  if (!canvas || !window.Chart) { showChartFallback('chart-trend-wrap'); return; }

  const ctx   = canvas.getContext('2d');
  const trend = MockData.getTrend(_activePeriod);

  const gradient = ctx.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, 'rgba(181,101,29,0.22)');
  gradient.addColorStop(1, 'rgba(181,101,29,0)');

  _trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trend.labels,
      datasets: [{
        label: 'Insiden',
        data:  trend.data,
        borderColor: '#B5651D',
        backgroundColor: gradient,
        fill: true,
        tension: 0.42,
        borderWidth: 2.5,
        pointBackgroundColor: '#B5651D',
        pointBorderColor: '#fff',
        pointBorderWidth: 2.5,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: '#8A4B15',
        pointHoverBorderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1C2431',
          titleColor: '#fff',
          bodyColor: 'rgba(255,255,255,0.65)',
          padding: 12,
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          displayColors: false,
          callbacks: {
            title: (ctx) => ctx[0].label,
            label: (ctx) => `  ${ctx.parsed.y} insiden aktif`,
          },
        },
      },
      scales: {
        x: {
          grid:   { display: false },
          border: { display: false },
          ticks:  { color: '#6C757D', font: { family: 'Inter', size: 11 }, padding: 6 },
        },
        y: {
          grid:   { color: 'rgba(0,0,0,0.05)', lineWidth: 1 },
          border: { display: false },
          ticks:  { color: '#6C757D', font: { family: 'Inter', size: 11 }, padding: 8, stepSize: 10 },
          min: 0,
          suggestedMax: Math.max(...trend.data) + 12,
        },
      },
      animation: { duration: 800, easing: 'easeOutQuart' },
    },
  });
}

function switchPeriod(period) {
  _activePeriod = period;
  document.querySelectorAll('.period-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.period === period);
  });
  if (!_trendChart) return;
  const trend = MockData.getTrend(period);
  _trendChart.data.labels              = trend.labels;
  _trendChart.data.datasets[0].data   = trend.data;
  _trendChart.options.scales.y.suggestedMax = Math.max(...trend.data) + 12;
  _trendChart.update('active');
}

function showChartFallback(wrapperId) {
  const w = document.getElementById(wrapperId);
  if (w) w.innerHTML = `<div class="empty-state" style="padding:40px 20px">
    <i class="fas fa-chart-line"></i>
    <h3>Chart.js tidak tersedia</h3>
    <p>Periksa koneksi internet untuk memuat library chart.</p>
  </div>`;
}

/* ============================================================
   INCIDENT TYPE CHART — doughnut
   ============================================================ */
function initTypeChart() {
  const canvas = document.getElementById('chart-types');
  if (!canvas || !window.Chart) return;

  const types = MockData.getIncidentTypes();
  const total = types.data.reduce((a, b) => a + b, 0);

  // Center text plugin
  const centerTextPlugin = {
    id: 'centerText',
    afterDraw(chart) {
      const { ctx, width, height } = chart;
      ctx.save();
      ctx.font = `900 22px Inter, sans-serif`;
      ctx.fillStyle = '#212529';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(total, width / 2, height / 2 - 9);
      ctx.font = `600 10px Inter, sans-serif`;
      ctx.fillStyle = '#6C757D';
      ctx.fillText('Total', width / 2, height / 2 + 11);
      ctx.restore();
    },
  };

  _typeChart = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    plugins: [centerTextPlugin],
    data: {
      labels: types.labels,
      datasets: [{
        data: types.data,
        backgroundColor: types.colors,
        borderWidth: 0,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1C2431',
          titleColor: '#fff',
          bodyColor: 'rgba(255,255,255,0.65)',
          padding: 11,
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          displayColors: true,
          callbacks: {
            label: (ctx) => `  ${ctx.label}: ${ctx.parsed} (${((ctx.parsed/total)*100).toFixed(1)}%)`,
          },
        },
      },
      animation: { duration: 900, easing: 'easeOutQuart' },
    },
  });

  // Custom legend
  const legend = document.getElementById('donut-legend');
  if (legend) {
    legend.innerHTML = types.labels.map((label, i) => `
      <div class="legend-item">
        <span class="legend-dot" style="background:${types.colors[i]}"></span>
        <span class="legend-label">${label}</span>
        <span class="legend-value">${types.data[i]}</span>
        <span class="legend-pct">${((types.data[i]/total)*100).toFixed(0)}%</span>
      </div>`).join('');
  }
}

/* ============================================================
   LIVE ALERT STREAM
   ============================================================ */
function renderAlerts() {
  const stream = document.getElementById('alert-stream');
  if (!stream) return;
  const alerts = MockData.getAlerts();
  stream.innerHTML = alerts.map(a => buildAlertHTML(a)).join('');
  _alertCount = alerts.length;
  syncAlertBadge();
}

function buildAlertHTML(alert) {
  const cfg = {
    high:    { iconClass:'danger',  badgeClass:'badge-danger',  label: alert.label || 'KRITIS'  },
    warning: { iconClass:'warning', badgeClass:'badge-warning', label: alert.label || 'WASPADA' },
    info:    { iconClass:'info',    badgeClass:'badge-info',    label: alert.label || 'INFO'    },
    success: { iconClass:'success', badgeClass:'badge-success', label: alert.label || 'OK'      },
  };
  const c = cfg[alert.severity] || cfg.info;
  const timeText = alert.time === 0 ? 'Baru saja' : `${alert.time} mnt lalu`;
  return `
    <div class="alert-item" data-severity="${alert.severity}">
      <div class="alert-icon-wrap ${c.iconClass}"><i class="fas ${alert.icon}"></i></div>
      <div class="alert-body">
        <div class="alert-top">
          <span class="alert-title">${alert.title}</span>
          <span class="badge ${c.badgeClass}">${c.label}</span>
        </div>
        <div class="alert-desc">${alert.desc}</div>
        <div class="alert-time"><i class="fas fa-clock"></i> ${timeText}</div>
      </div>
    </div>`;
}

function addLiveAlert() {
  const stream = document.getElementById('alert-stream');
  if (!stream) return;
  const alert = MockData.generateAlert();
  const tmp   = document.createElement('div');
  tmp.innerHTML = buildAlertHTML(alert);
  const el = tmp.firstElementChild;
  el.style.opacity   = '0';
  el.style.transform = 'translateX(12px)';
  stream.insertBefore(el, stream.firstChild);
  requestAnimationFrame(() => {
    el.style.transition = 'all 0.35s ease';
    el.style.opacity    = '1';
    el.style.transform  = 'translateX(0)';
  });
  _alertCount++;
  syncAlertBadge();
  // Trim old
  while (stream.children.length > MAX_ALERTS) stream.removeChild(stream.lastElementChild);
  // Update navbar badge
  const navBadge = document.getElementById('notif-badge');
  if (navBadge) navBadge.textContent = Math.min(parseInt(navBadge.textContent || 0) + 1, 99);
}

function syncAlertBadge() {
  const b = document.getElementById('alert-count-badge');
  if (b) b.textContent = _alertCount;
}

/* ============================================================
   RESOURCES
   ============================================================ */
function renderResources() {
  const list = document.getElementById('resource-list');
  if (!list) return;

  const colorVar = { copper:'copper', success:'success', info:'info', warning:'warning', danger:'danger', gold:'gold-dark' };

  list.innerHTML = MockData.getResources().map(r => {
    const fillClass = r.pct >= 70 ? 'success' : r.pct >= 45 ? 'warning' : 'danger';
    const cvar = colorVar[r.colorKey] || 'copper';
    return `
      <div class="resource-item">
        <div class="resource-header">
          <div class="resource-label">
            <i class="fas ${r.icon}" style="color:var(--${cvar})"></i>
            <span>${r.label}</span>
          </div>
          <div class="resource-meta">
            <span class="resource-pct">${r.pct}%</span>
            <span class="resource-unit">${r.unit}</span>
          </div>
        </div>
        <div class="progress-wrap">
          <div class="progress-fill ${fillClass}" data-target="${r.pct}" style="width:0%"></div>
        </div>
      </div>`;
  }).join('');

  // Animate bars with stagger
  document.querySelectorAll('.progress-fill[data-target]').forEach((bar, i) => {
    setTimeout(() => {
      bar.style.transition = 'width 0.9s cubic-bezier(0.4,0,0.2,1)';
      bar.style.width = bar.dataset.target + '%';
    }, 120 + i * 80);
  });
}

/* ============================================================
   AI AGENTS
   ============================================================ */
function renderAIAgents() {
  const grid = document.getElementById('ai-grid');
  if (!grid) return;

  const statusCfg = {
    online:  { dotColor:'success', label:'Online'      },
    active:  { dotColor:'info',    label:'Aktif'        },
    warning: { dotColor:'warning', label:'Terbatas'     },
    offline: { dotColor:'danger',  label:'Offline'      },
  };
  const confColor = (v) => v >= 85 ? 'success' : v >= 70 ? 'warning' : 'danger';

  grid.innerHTML = MockData.getAIAgents().map(a => {
    const sc = statusCfg[a.status] || statusCfg.online;
    const spinClass = a.status === 'active' ? 'anim-spin' : '';
    return `
      <div class="ai-card" data-agent="${a.id}">
        <div class="ai-header">
          <div class="ai-icon ai-color-${a.color}">
            <i class="fas ${a.icon}"></i>
          </div>
          <div class="ai-title-block">
            <span class="ai-name">${a.name}</span>
            <span class="ai-status-pill">
              <span class="ai-dot" style="background:var(--${sc.dotColor}); ${a.status==='active'?'animation:pulse 1.4s infinite':''}"></span>
              ${sc.label}
            </span>
          </div>
          <div class="ai-conf">
            <span class="ai-conf-val" style="color:var(--${confColor(a.confidence)})">${a.confidence}%</span>
            <span class="ai-conf-label">akurasi</span>
          </div>
        </div>
        <div class="ai-fullname">${a.fullName}</div>
        <div class="ai-task">
          <i class="fas fa-cog ${spinClass}"></i>
          <span>${a.task}</span>
        </div>
        <div class="ai-footer">
          <span class="ai-data"><i class="fas fa-database"></i> ${a.processed} data</span>
          <span class="ai-time">${a.lastRun}</span>
        </div>
      </div>`;
  }).join('');
}

/* ============================================================
   REGIONAL STATUS TABLE
   ============================================================ */
function initRegionsTable() {
  const tbody = document.getElementById('regions-tbody');
  if (!tbody) return;

  const levelColor = { 4:'danger', 3:'warning', 2:'info', 1:'success' };
  const levelLabel = { 4:'SIAGA IV', 3:'SIAGA III', 2:'SIAGA II', 1:'SIAGA I' };

  tbody.innerHTML = MockData.getRegions().map(r => `
    <tr>
      <td><strong>${r.name}</strong></td>
      <td><span class="badge badge-${levelColor[r.level] || 'info'}">${levelLabel[r.level]}</span></td>
      <td>${r.type}</td>
      <td><strong>${r.incidents}</strong></td>
      <td>
        <div class="progress-wrap" style="width:80px">
          <div class="progress-fill ${levelColor[r.level] || 'info'}" style="width:${r.level*25}%; transition:none;"></div>
        </div>
      </td>
    </tr>`).join('');
}

/* ============================================================
   LIVE SIMULATION
   ============================================================ */
function startLiveSimulation() {
  function scheduleAlert() {
    const delay = 22000 + Math.random() * 18000;  // 22–40 s
    _liveTimer = setTimeout(() => {
      addLiveAlert();
      Toast.info('Alert Baru', 'Laporan masuk dari lapangan', 2500);
      scheduleAlert();
    }, delay);
  }
  scheduleAlert();
}

function updateLastUpdated() {
  const el = document.getElementById('last-updated');
  if (el) {
    const now = new Date().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
    el.textContent = `Diperbarui pukul ${now}`;
  }
}

/* ============================================================
   EXPOSE
   ============================================================ */
Object.assign(window, { initDashboard, switchPeriod });
