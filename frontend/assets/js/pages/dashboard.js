/* ============================================
   DRCC — dashboard.js (Fullstack API version)
   Semua data dari backend REST API + WebSocket real-time
   ============================================ */
'use strict';

let trendChart = null;
let typeChart  = null;
let currentPeriod = '7d';

/* ============================================================ INIT */
async function initDashboard() {
  buildAppShell('dashboard', 'Dashboard', 'Ringkasan status darurat dan sumber daya seluruh wilayah Indonesia');
  startClock();

  await Promise.all([
    loadSummary(),
    loadAlertStream(),
    loadResources(),
    loadDemoQuickLaunch(),
    loadEvidenceCard(),
  ]);

  Helpers_setText('last-updated', `Diperbarui pukul ${new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}`);

  /* ── Real-time: dengarkan event WebSocket, refresh bagian terkait ── */
  if (window.State) {
    State.on('incident:created', () => { loadSummary(); loadAlertStream(); });
    State.on('incident:updated', () => { loadSummary(); loadAlertStream(); });
    State.on('incident:deleted', () => { loadSummary(); loadAlertStream(); });
    State.on('resource:created', loadResources);
    State.on('resource:updated', loadResources);
    State.on('resource:deleted', loadResources);
    State.on('demo:scenario:complete', loadDemoQuickLaunch);
  }
}

function Helpers_setText(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt; }
function fmtNum(n) { return (n || 0).toLocaleString('id-ID'); }

/* ============================================================ SUMMARY (stat cards + charts + layer status) */
async function loadSummary() {
  let data;
  try { data = await ApiClient.get('/dashboard/summary'); }
  catch (e) { Toast.error('Gagal Memuat', e.message); return; }

  renderStatCards(data);
  renderTrendChart(data.trend || []);
  renderTypeChart(data.byType || []);
  renderLayerStatus(data.layerStatus || {});
  renderAiGrid();
  renderRegionsTable(data.byType || []);
}

function renderStatCards(data) {
  const inc = data.incidents || {};
  const res = data.resources || {};
  const cards = [
    { id:'sc-incidents', icon:'fa-triangle-exclamation', color:'danger',  label:'Insiden Aktif',     value: inc.aktif || 0,  sub:`${inc.total||0} total tercatat` },
    { id:'sc-affected',  icon:'fa-users',                color:'warning', label:'Insiden Bahaya',    value: inc.bahaya || 0, sub:'level BAHAYA saat ini' },
    { id:'sc-shelters',  icon:'fa-box-open',              color:'info',    label:'Sumber Daya Siap',  value: res.tersedia || 0, sub:`${res.total||0} total aset` },
    { id:'sc-personnel', icon:'fa-brain',                 color:'success', label:'Analisis AI',       value: data.aiAnalyses || 0, sub:'total dijalankan' },
  ];
  cards.forEach(c => {
    const el = document.getElementById(c.id);
    if (!el) return;
    el.innerHTML = `
      <div class="stat-icon" style="background:var(--${c.color}-bg);color:var(--${c.color})"><i class="fas ${c.icon}"></i></div>
      <div class="stat-value">${fmtNum(c.value)}</div>
      <div class="stat-label">${c.label}</div>
      <div class="stat-sub">${c.sub}</div>`;
  });
}

function renderTrendChart(trend) {
  const ctx = document.getElementById('chart-trend');
  if (!ctx || typeof Chart === 'undefined') return;
  const labels = trend.map(t => new Date(t.d).toLocaleDateString('id-ID', { day:'2-digit', month:'short' }));
  const values = trend.map(t => t.count);

  if (trendChart) trendChart.destroy();
  trendChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ data: values, borderColor: '#B5651D', backgroundColor: 'rgba(181,101,29,.08)', fill: true, tension: 0.35, pointRadius: 3 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
  });
}

function renderTypeChart(byType) {
  const ctx = document.getElementById('chart-types');
  if (!ctx || typeof Chart === 'undefined') return;
  const colors = { gempa:'#E74C3C', banjir:'#2980B9', longsor:'#D35400', kebakaran:'#C0392B', lainnya:'#7F8C8D' };
  const labels = byType.map(t => t.type);
  const values = byType.map(t => t.count);
  const total  = values.reduce((a,b)=>a+b, 0);

  if (typeChart) typeChart.destroy();
  typeChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: labels.map(l => colors[l] || '#6C757D'), borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false } } },
  });

  const legend = document.getElementById('donut-legend');
  if (legend) {
    legend.innerHTML = byType.map(t => `
      <div class="legend-item">
        <span class="legend-dot" style="background:${colors[t.type]||'#6C757D'}"></span>
        <span class="legend-label">${t.type}</span>
        <span class="legend-pct">${total ? Math.round(t.count/total*100) : 0}%</span>
      </div>`).join('') || '<span style="font-size:12px;color:var(--text-muted)">Belum ada data</span>';
  }
}

function renderLayerStatus(layerStatus) {
  const bar = document.getElementById('dash-layer-bar');
  if (!bar) return;
  const LAYERS = [
    { id:1, name:'Input Signal',        icon:'fa-broadcast-tower' },
    { id:2, name:'Signal Processing',   icon:'fa-microchip' },
    { id:3, name:'AI Agent',            icon:'fa-brain' },
    { id:4, name:'Prediction/Decision', icon:'fa-scale-balanced' },
    { id:5, name:'User Action',         icon:'fa-user-shield' },
  ];
  bar.innerHTML = LAYERS.map(l => {
    const done = layerStatus[l.id];
    const col  = done ? 'var(--success)' : 'var(--border)';
    return `<div style="flex:1;min-width:120px;display:flex;align-items:center;gap:6px;padding:8px 10px;border-radius:10px;border:1.5px solid ${col};background:${done?'rgba(39,174,96,.08)':'var(--bg)'}">
      <i class="fas ${l.icon}" style="color:${done?'var(--success)':'var(--text-light)'}"></i>
      <div style="min-width:0"><div style="font-size:9px;color:var(--text-muted)">Layer ${l.id}</div><div style="font-size:11px;font-weight:700;color:${done?'var(--success)':'var(--text-light)'}">${l.name}</div></div>
      <span style="margin-left:auto">${done?'✅':'○'}</span>
    </div>`;
  }).join('');
}

/* ============================================================ AI AGENTS (static display — detail di ai-command.html) */
function renderAiGrid() {
  const grid = document.getElementById('ai-grid');
  if (!grid) return;
  const agents = [
    { name:'ARIA',  role:'Situation Analyst',     icon:'fa-magnifying-glass-chart', color:'#B5651D' },
    { name:'LOGI',  role:'Logistics Prioritizer', icon:'fa-boxes-stacking',         color:'#2980B9' },
    { name:'RECON', role:'Response Commander',    icon:'fa-map-location-dot',       color:'#27AE60' },
    { name:'PULSE', role:'Public Alert System',   icon:'fa-bullhorn',               color:'#8E44AD' },
  ];
  grid.innerHTML = agents.map(a => `
    <div class="ai-card">
      <div class="ai-card-icon" style="background:${a.color}1a;color:${a.color}"><i class="fas ${a.icon}"></i></div>
      <div class="ai-card-name">${a.name}</div>
      <div class="ai-card-role">${a.role}</div>
      <div class="ai-card-status"><span class="status-dot idle"></span>Siap (Gemini)</div>
    </div>`).join('');
}

/* ============================================================ REGIONS TABLE (derived from byType data) */
function renderRegionsTable(byType) {
  const tbody = document.getElementById('regions-tbody');
  if (!tbody) return;
  if (!byType.length) { tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">Belum ada data insiden</td></tr>`; return; }
  tbody.innerHTML = byType.map(t => `
    <tr>
      <td>${t.type}</td>
      <td><span class="badge badge-warning">Termonitor</span></td>
      <td>${t.type}</td>
      <td>${t.count}</td>
      <td><span class="badge badge-info">—</span></td>
    </tr>`).join('');
}

/* ============================================================ ALERT STREAM (insiden terbaru) */
async function loadAlertStream() {
  let data;
  try { data = await ApiClient.get('/incidents'); }
  catch (e) { return; }

  const stream = document.getElementById('alert-stream');
  const badge  = document.getElementById('alert-count-badge');
  if (badge) badge.textContent = data.incidents.filter(i => i.status === 'aktif').length;
  if (!stream) return;

  const levelColor = { BAHAYA:'#E74C3C', SIAGA:'#E67E22', WASPADA:'#F39C12', NORMAL:'#27AE60' };
  const recent = data.incidents.slice(0, 8);
  stream.innerHTML = recent.length ? recent.map(i => `
    <div class="alert-item">
      <span class="alert-dot" style="background:${levelColor[i.severity]||'#6C757D'}"></span>
      <div class="alert-content">
        <div class="alert-title">${i.title}</div>
        <div class="alert-meta">${i.location}, ${i.province} · ${new Date(i.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</div>
      </div>
      <span class="badge" style="background:${levelColor[i.severity]}1a;color:${levelColor[i.severity]}">${i.severity}</span>
    </div>`).join('') : '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:12px">Belum ada alert</div>';
}

/* ============================================================ RESOURCES */
async function loadResources() {
  let data;
  try { data = await ApiClient.get('/resources/stats'); }
  catch (e) { return; }

  const list = document.getElementById('resource-list');
  if (!list) return;
  const byType = data.byType || [];
  const colors = ['#B5651D','#2980B9','#27AE60','#E67E22','#8E44AD','#C0392B'];
  list.innerHTML = byType.length ? byType.map((r, i) => `
    <div class="resource-row">
      <div class="resource-row-label">
        <span>${r.type}</span><span>${r.count} unit</span>
      </div>
      <div class="resource-bar-track"><div class="resource-bar-fill" style="width:${Math.min(100, r.count*10)}%;background:${colors[i%colors.length]}"></div></div>
    </div>`).join('') : '<span style="font-size:12px;color:var(--text-muted)">Belum ada sumber daya</span>';
}

/* ============================================================ DEMO QUICK-LAUNCH */
async function loadDemoQuickLaunch() {
  if (!window.DEMO_SCENARIOS) return;
  let completed = [];
  try {
    const data = await ApiClient.get('/evidence/scenarios/completed');
    completed = data.completed || [];
  } catch (e) { /* user mungkin bukan admin/operator — endpoint 403, abaikan */ }

  const grid = document.getElementById('dash-demo-grid');
  const cnt  = document.getElementById('dash-demo-count');
  if (cnt) cnt.textContent = `${completed.length}/10 skenario dijalankan`;
  if (!grid) return;

  grid.innerHTML = DEMO_SCENARIOS.map(scn => {
    const isDone = completed.includes(scn.id);
    return `<button onclick="dashRunScenario('${scn.id}')" type="button"
      style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:${isDone?scn.color+'18':'var(--bg)'};border:1.5px solid ${isDone?scn.color:'var(--border)'};border-radius:10px;cursor:pointer;text-align:left">
      <i class="fas ${scn.icon}" style="color:${scn.color};font-size:14px"></i>
      <div style="min-width:0"><div style="font-size:11px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${scn.name}</div>
      <div style="font-size:10px;color:var(--text-muted)">${isDone?'✅ Selesai':'▶ Jalankan'}</div></div>
    </button>`;
  }).join('');
}

async function dashRunScenario(id) {
  const scn = DEMO_SCENARIOS.find(s => s.id === id);
  if (!scn) return;
  Toast.info('Demo Dimulai', `Menjalankan: ${scn.name}`);
  try {
    await ApiClient.post(`/evidence/scenarios/${id}/run`, { scenario: scn });
    Toast.success('Demo Selesai', `${scn.name} berhasil dijalankan`);
    await Promise.all([loadSummary(), loadAlertStream(), loadDemoQuickLaunch()]);
  } catch (e) {
    Toast.error('Demo Gagal', e.message);
  }
}

/* ============================================================ EVIDENCE SUMMARY (admin/operator only) */
async function loadEvidenceCard() {
  const card = document.getElementById('dash-evidence-card');
  if (!card) return;
  if (!Auth.can('demoCenter', 'view')) { card.innerHTML = ''; return; }

  let data;
  try { data = await ApiClient.get('/evidence/summary'); }
  catch (e) { card.innerHTML = ''; return; }

  const lc = data.layerCompleteness;
  const ev = data.evidence;
  card.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">5 Layer Completeness</div>
        <div style="font-size:32px;font-weight:900;color:${lc.score===100?'var(--success)':'var(--copper)'}">${lc.score}%</div>
        <div style="font-size:12px;color:var(--text-muted)">${lc.filled}/5 layer aktif</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">Bukti UAS</div>
        <div style="font-size:28px;font-weight:900;color:var(--copper)">${ev.scenariosCompleted}<span style="font-size:14px;color:var(--text-muted)">/10</span></div>
        <div style="font-size:12px;color:var(--text-muted)">skenario dijalankan · ${ev.aiAnalysesRun} analisis AI · ${ev.anomaliesDetected} anomali</div>
      </div>
    </div>`;
}

/* ============================================================ CLOCK & PERIOD SWITCH */
function startClock() {
  const el = document.getElementById('navbar-clock');
  if (!el) return;
  const tick = () => { el.textContent = new Date().toLocaleTimeString('id-ID'); };
  tick(); setInterval(tick, 1000);
}

function switchPeriod(p) {
  currentPeriod = p;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.toggle('active', b.dataset.period === p));
  loadSummary(); // backend trend currently fixed 30d window; client just re-renders
}

Object.assign(window, { initDashboard, switchPeriod, dashRunScenario });
