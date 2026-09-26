/* ============================================
   DRCC — signals.js (Fullstack API + Real-time)
   Layer 1: Input Signal CRUD + Layer 2: Processing Pipeline
   ============================================ */
'use strict';

let allSignals  = [];
let sigFilter   = 'all';
let editingNewSignal = false;

const TYPE_META = {
  gempa:       { icon:'fa-wave-square',       color:'#E74C3C', cat:'sensor' },
  banjir:      { icon:'fa-water',             color:'#2980B9', cat:'sensor' },
  cuaca:       { icon:'fa-cloud-rain',        color:'#34495E', cat:'sensor' },
  angin:       { icon:'fa-wind',               color:'#7F8C8D', cat:'sensor' },
  relawan:     { icon:'fa-people-group',       color:'#27AE60', cat:'ops' },
  pengungsian: { icon:'fa-campground',         color:'#F39C12', cat:'ops' },
  kebakaran:   { icon:'fa-fire',                color:'#E67E22', cat:'sensor' },
  cctv:        { icon:'fa-video',               color:'#8E44AD', cat:'visual' },
  sosmed:      { icon:'fa-share-nodes',         color:'#9B59B6', cat:'sosmed' },
};

const LEVEL_COLOR = { BAHAYA:'#E74C3C', SIAGA:'#E67E22', WASPADA:'#F39C12', NORMAL:'#27AE60' };

/* ============================================================ INIT */
async function initSignals() {
  buildAppShell('signals', 'Signal Monitor', 'Pemantauan sinyal Layer 1 (Input) & Layer 2 (Processing)');
  await Promise.all([loadSignals(), loadProcessingLog(), loadAnomalies()]);

  if (window.State) {
    State.on('signal:created',   loadSignals);
    State.on('signal:updated',   loadSignals);
    State.on('signal:processed', (ev) => { prependLogEntry(ev); updateRawFilteredDisplay(ev); loadSignals(); });
    State.on('anomaly:new',      () => loadAnomalies());
  }
}

/* ============================================================ SIGNALS GRID (Layer 1) */
async function loadSignals() {
  try {
    const data = await ApiClient.get('/signals');
    allSignals = data.signals;
    renderSummary();
    renderGrid();
  } catch (e) { Toast.error('Gagal Memuat Sinyal', e.message); }
}

function renderSummary() {
  const counts = { NORMAL:0, WASPADA:0, SIAGA:0, BAHAYA:0, nonaktif:0 };
  allSignals.forEach(s => {
    if (s.status === 'nonaktif') counts.nonaktif++;
  });
  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent = v; };
  set('count-normal', allSignals.filter(s=>s.status==='aktif').length);
  set('count-nonaktif', counts.nonaktif);
}

function renderGrid() {
  const grid = document.getElementById('signal-grid');
  if (!grid) return;

  let items = allSignals;
  if (sigFilter === 'inactive') items = items.filter(s => s.status === 'nonaktif');
  else if (sigFilter !== 'all') items = items.filter(s => (TYPE_META[s.type]?.cat || 'sensor') === sigFilter);

  grid.innerHTML = items.map(s => {
    const meta = TYPE_META[s.type] || { icon:'fa-satellite-dish', color:'#6C757D' };
    const isActive = s.status === 'aktif';
    return `
      <div class="signal-panel" style="opacity:${isActive?1:.5}">
        <div class="signal-panel-header">
          <div class="signal-panel-icon" style="background:${meta.color}1a;color:${meta.color}"><i class="fas ${meta.icon}"></i></div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:800;font-size:13px">${s.name}</div>
            <div style="font-size:10px;color:var(--text-muted)">${s.source||'—'} · ${s.id}</div>
          </div>
          <label class="sig-toggle">
            <input type="checkbox" ${isActive?'checked':''} onchange="toggleSignal('${s.id}')">
            <span class="sig-toggle-slider"></span>
          </label>
        </div>
        <div class="signal-value" style="color:${meta.color}">${s.current_value ?? '—'} <span style="font-size:11px;color:var(--text-muted)">${s.unit||''}</span></div>
        <div style="display:flex;gap:6px;margin-top:10px">
          <input type="number" step="any" placeholder="Input nilai baru..." id="inp-${s.id}" style="flex:1;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--bg);color:var(--text)">
          <button class="btn btn-primary btn-sm" onclick="processSignal('${s.id}')" type="button" ${!isActive?'disabled':''}><i class="fas fa-play"></i></button>
        </div>
      </div>`;
  }).join('') || '<div style="text-align:center;color:var(--text-muted);padding:30px;grid-column:1/-1">Tidak ada sinyal pada filter ini.</div>';
}

function filterSignals(f) {
  sigFilter = f;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.toggle('active', t.dataset.filter === f));
  renderGrid();
}

async function toggleSignal(id) {
  try {
    await ApiClient.post(`/signals/${id}/toggle`, {});
    await loadSignals();
  } catch (e) { Toast.error('Gagal', e.message); }
}

/* ============================================================ LAYER 2: PROCESSING */
async function processSignal(id) {
  const input = document.getElementById(`inp-${id}`);
  const rawValue = parseFloat(input?.value);
  if (isNaN(rawValue)) { Toast.warning('Isi Nilai', 'Masukkan nilai sinyal untuk diproses.'); return; }

  const sig = allSignals.find(s => s.id === id);
  try {
    const data = await ApiClient.post(`/signals/${id}/process`, { rawValue, signalName: sig?.name, source: sig?.source });
    prependLogEntry(data.result);
    updateRawFilteredDisplay(data.result);
    if (data.anomaly) refreshAnomalyDisplay();
    if (input) input.value = '';
    await loadSignals();
  } catch (e) { Toast.error('Gagal Memproses', e.message); }
}

async function generateAllDemoData() {
  const baseVals = {
    gempa:[1.2,2.8,3.5,4.1,4.7,5.2,5.8,6.2,6.8,7.1], banjir:[45,80,110,145,175,200,235,265,285,310],
    cuaca:[10,22,38,55,68,80,92,108,125,145], angin:[15,28,42,55,63,74,82,90,98,108],
    pengungsian:[8,18,28,38,48,55,64,72,82,91], kebakaran:[22,25,27,29,31,33,35,37,39,41],
  };
  Toast.info('Memproses...', 'Generate demo data untuk semua sinyal aktif');
  for (const sig of allSignals.filter(s => s.status === 'aktif')) {
    const vals = baseVals[sig.type] || [10,20,30,40,50,60,70,80,90,100];
    for (const v of vals.slice(0, 3)) { // 3 sample per signal supaya tidak terlalu lama
      try {
        const data = await ApiClient.post(`/signals/${sig.id}/process`, { rawValue: v, signalName: sig.name, source: sig.source });
        prependLogEntry(data.result);
      } catch (e) {}
      await new Promise(r => setTimeout(r, 120));
    }
  }
  await loadSignals(); refreshAnomalyDisplay();
  Toast.success('Selesai', 'Demo data berhasil digenerate untuk semua sinyal');
}

/* ============================================================ PROCESSING LOG */
async function loadProcessingLog() {
  try {
    const data = await ApiClient.get('/signals/processing-log?limit=30');
    const container = document.getElementById('proc-log-container');
    if (!container) return;
    container.innerHTML = data.log.length
      ? data.log.map(logToHtml).join('')
      : '<div style="color:#64748B">Belum ada data diproses. Klik tombol proses pada sinyal.</div>';
  } catch (e) {}
}

function logToHtml(r) {
  const col = r.anomaly ? '#EF4444' : '#4ADE80';
  const aTag = r.anomaly ? `<span style="background:#EF444433;color:#EF4444;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:700">ANOMALI:${r.anomaly_level}</span>` : '';
  return `<div style="padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;gap:6px;align-items:center">
    <span style="color:#64748B;font-size:10px;flex-shrink:0">${new Date(r.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
    <span style="color:#94A3B8;flex:1">${r.signal_name}: raw=${r.raw_value} → filtered=${r.filtered_value} | score=${r.priority_score}</span>
    ${aTag}
  </div>`;
}

function prependLogEntry(r) {
  const container = document.getElementById('proc-log-container');
  if (!container) return;
  const html = logToHtml({
    created_at: r.ts || Date.now(), signal_name: r.signalName, raw_value: r.rawValue,
    filtered_value: r.filteredValue, priority_score: r.priorityScore, anomaly: r.anomaly, anomaly_level: r.anomalyLevel,
  });
  container.insertAdjacentHTML('afterbegin', html);
}

function updateRawFilteredDisplay(r) {
  const raw = document.getElementById('raw-signal-display');
  const flt = document.getElementById('filtered-signal-display');
  if (raw) raw.innerHTML = `${r.signalName}: <strong>${r.rawValue}</strong>`;
  if (flt) flt.innerHTML = `${r.signalName}: <strong>${r.filteredValue}</strong> <span style="font-size:10px;color:var(--text-muted)">(Δ=${Math.abs(r.rawValue-r.filteredValue).toFixed(3)})</span>`;
}

/* ============================================================ ANOMALIES */
async function loadAnomalies() { await refreshAnomalyDisplay(); }

async function refreshAnomalyDisplay() {
  try {
    const data = await ApiClient.get('/signals/anomalies?limit=5');
    const container = document.getElementById('anomaly-alerts');
    if (!container) return;
    container.innerHTML = data.anomalies.length ? data.anomalies.map(a => {
      const col = LEVEL_COLOR[a.level] || '#6C757D';
      return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:${col}15;border:1px solid ${col}44;border-radius:8px;font-size:11px;margin-bottom:4px">
        <i class="fas fa-triangle-exclamation" style="color:${col}"></i>
        <span style="font-weight:700;color:${col}">${a.level}</span>
        <span style="color:var(--text)">${a.signal_name}: ${a.value} (threshold: ${a.threshold})</span>
        <span style="margin-left:auto;color:var(--text-muted);font-size:10px">${new Date(a.created_at).toLocaleTimeString('id-ID')}</span>
      </div>`;
    }).join('') : '';
  } catch (e) {}
}

/* ============================================================ ADD SIGNAL MODAL */
function showAddSignalModal() {
  document.getElementById('add-signal-form')?.reset();
  document.getElementById('add-signal-modal')?.classList.remove('hidden');
}
function hideAddSignalModal() { document.getElementById('add-signal-modal')?.classList.add('hidden'); }

async function submitAddSignal() {
  const name = document.getElementById('f-name').value.trim();
  const type = document.getElementById('f-type').value;
  if (!name) { Toast.warning('Lengkapi Form', 'Nama sinyal wajib diisi.'); return; }

  const id = 'SIG-' + Math.random().toString(36).slice(2,7).toUpperCase();
  try {
    await ApiClient.post('/signals', {
      id, name, type,
      unit: document.getElementById('f-unit').value.trim() || null,
      source: document.getElementById('f-source').value.trim() || null,
    });
    Toast.success('Sinyal Ditambahkan', name);
    hideAddSignalModal();
    await loadSignals();
  } catch (e) { Toast.error('Gagal Menambahkan', e.message); }
}

/* ============================================================ MISC (export, dll) */
async function exportSignalCSV() {
  try {
    const data = await ApiClient.get('/signals/processing-log?limit=300');
    if (!data.log.length) { Toast.warning('Kosong', 'Belum ada data untuk diekspor.'); return; }
    const rows = ['Waktu,Sinyal,Raw,Filtered,Score,Anomali,Level'];
    data.log.forEach(r => rows.push([new Date(r.created_at).toLocaleString('id-ID'), r.signal_name, r.raw_value, r.filtered_value, r.priority_score, r.anomaly?'YA':'TIDAK', r.anomaly_level].join(',')));
    const blob = new Blob(['\uFEFF'+rows.join('\n')], { type:'text/csv' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `signal_log_${Date.now()}.csv` });
    a.click();
    Toast.success('Diekspor', `${data.log.length} baris log diekspor`);
  } catch (e) { Toast.error('Gagal Ekspor', e.message); }
}

function saveToStorage() { Toast.info('Info', 'Data sudah otomatis tersimpan di database server.'); }
function clearHistory()  { Toast.info('Info', 'Riwayat processing tersimpan permanen di database untuk audit trail.'); }

Object.assign(window, {
  initSignals, filterSignals, toggleSignal, processSignal, generateAllDemoData,
  showAddSignalModal, hideAddSignalModal, submitAddSignal, exportSignalCSV, saveToStorage, clearHistory,
});
