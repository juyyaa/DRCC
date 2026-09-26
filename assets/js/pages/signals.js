/* ============================================
   DRCC — signals.js
   Signal Monitor: 7 panel, toggle, priority, form, LocalStorage
   ============================================ */

'use strict';

/* ============================================================
   7 DEFAULT SIGNAL DEFINITIONS
   ============================================================ */
const DEFAULT_SIGNALS = [
  {
    id: 'SIG-001', name: 'Gempa Bumi', type: 'sensor',
    icon: 'fa-wave-square', color: '#E74C3C',
    source: 'BMKG Seismograph Network',
    unit: 'SR', decimals: 1, baseValue: 2.2, noiseRange: 0.9,
    min: 0, max: 9,
    thresholds: [{ value: 4.0, label: 'WASPADA' }, { value: 6.0, label: 'BAHAYA' }],
    updateInterval: 1500, spikeChance: 0.008, custom: false,
  },
  {
    id: 'SIG-002', name: 'Cuaca Ekstrem', type: 'sensor',
    icon: 'fa-cloud-bolt', color: '#3498DB',
    source: 'BMKG Weather Station',
    unit: 'mm/jam', decimals: 1, baseValue: 24, noiseRange: 18,
    min: 0, max: 200,
    thresholds: [{ value: 50, label: 'WASPADA' }, { value: 100, label: 'BAHAYA' }],
    updateInterval: 3000, spikeChance: 0.006, custom: false,
  },
  {
    id: 'SIG-003', name: 'CCTV / Visual', type: 'visual',
    icon: 'fa-camera', color: '#6C757D',
    source: '47 Kamera Lapangan Aktif',
    unit: 'event', decimals: 0, baseValue: 4, noiseRange: 6,
    min: 0, max: 80,
    thresholds: [{ value: 20, label: 'WASPADA' }, { value: 50, label: 'BAHAYA' }],
    updateInterval: 4000, spikeChance: 0.010, custom: false,
  },
  {
    id: 'SIG-004', name: 'Sosial Media', type: 'sosmed',
    icon: 'fa-hashtag', color: '#9B59B6',
    source: 'Twitter / Instagram / TikTok',
    unit: 'mention', decimals: 0, baseValue: 360, noiseRange: 260,
    min: 0, max: 5000,
    thresholds: [{ value: 1000, label: 'WASPADA' }, { value: 3000, label: 'BAHAYA' }],
    updateInterval: 4500, spikeChance: 0.007, custom: false,
  },
  {
    id: 'SIG-005', name: 'Relawan Aktif', type: 'ops',
    icon: 'fa-hands-helping', color: '#2ECC71',
    source: 'Sistem Koordinasi Relawan',
    unit: 'orang', decimals: 0, baseValue: 847, noiseRange: 55,
    min: 0, max: 2000,
    thresholds: [{ value: 1200, label: 'OPTIMAL' }],
    updateInterval: 6000, spikeChance: 0.003, custom: false,
  },
  {
    id: 'SIG-006', name: 'Pengungsian', type: 'ops',
    icon: 'fa-tent', color: '#F39C12',
    source: '23 Posko Pengungsian Aktif',
    unit: '% kapasitas', decimals: 1, baseValue: 63, noiseRange: 6,
    min: 0, max: 100,
    thresholds: [{ value: 80, label: 'WASPADA' }, { value: 95, label: 'BAHAYA' }],
    updateInterval: 7000, spikeChance: 0.004, custom: false,
  },
  {
    id: 'SIG-007', name: 'Logistik', type: 'ops',
    icon: 'fa-boxes-stacking', color: '#B5651D',
    source: 'Sistem Manajemen Gudang',
    unit: '% stok', decimals: 1, baseValue: 68, noiseRange: 3,
    min: 0, max: 100,
    thresholds: [{ value: 30, label: 'RENDAH' }, { value: 15, label: 'KRITIS' }],
    updateInterval: 9000, spikeChance: 0.001, custom: false,
  },
];

/* ============================================================
   STATE
   ============================================================ */
const SigState = {
  defs:     [],   // merged default + custom
  panels:   {},   // { id: { currentValue, history[], status, active, priority, lastUpdate } }
  canvases: {},   // { id: { ctx, W, H } }
  timers:   {},   // { id: intervalId }
  saveTimer: null,
};

const HISTORY_MAX = 80;

/* ============================================================
   INIT
   ============================================================ */
function initSignals() {
  const session = buildAppShell('signals', 'Signal Monitor', 'Pemantauan 7 sumber sinyal bencana');
  if (!session) return;

  // Merge default + saved custom signals
  const customs = AppStorage.signals.getCustom();
  SigState.defs = [...DEFAULT_SIGNALS, ...customs];

  loadFromStorage();
  renderSignalGrid();

  requestAnimationFrame(() => requestAnimationFrame(() => {
    initCanvases();
    startAllUpdates();
    updateStatusSummary();
    SigState.saveTimer = setInterval(autoSave, 60000);
  }));
}

/* ============================================================
   RENDER
   ============================================================ */
function renderSignalGrid() {
  const grid = document.getElementById('signal-grid');
  if (!grid) return;
  grid.innerHTML = SigState.defs.map(def => buildPanelHTML(def)).join('');
}

function buildPanelHTML(def) {
  const p       = SigState.panels[def.id] || {};
  const val     = (p.currentValue ?? def.baseValue).toFixed(def.decimals);
  const status  = (p.status  || 'NORMAL').toLowerCase();
  const active  = p.active  !== false;
  const priority= p.priority ?? 10;
  const priColor= priority >= 70 ? 'high' : priority >= 40 ? 'medium' : 'low';

  const typeLabels = { sensor:'Sensor', visual:'Visual', sosmed:'Sosmed', ops:'Operasional' };
  const r   = parseInt(def.color.slice(1,3),16);
  const g   = parseInt(def.color.slice(3,5),16);
  const b   = parseInt(def.color.slice(5,7),16);
  const iconBg = `rgba(${r},${g},${b},0.12)`;

  return `
  <div class="signal-panel ${active ? '' : 'inactive'}" id="panel-${def.id}" data-status="${active ? status : 'inactive'}" data-type="${def.type}">

    <!-- Header -->
    <div class="signal-header">
      <div class="signal-id-block">
        <div class="signal-icon-wrap" style="background:${iconBg};color:${def.color}">
          <i class="fas ${def.icon}"></i>
        </div>
        <div class="signal-id-text">
          <span class="signal-id-code">${def.name}</span>
          <span class="signal-id-name">${typeLabels[def.type] || def.type} · ${def.id}</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="signal-status-badge ${active ? status : 'inactive'}" id="status-${def.id}">
          ${active ? (p.status || 'NORMAL') : 'NONAKTIF'}
        </span>
        <label class="sig-toggle" title="${active ? 'Nonaktifkan' : 'Aktifkan'} sinyal">
          <input type="checkbox" ${active ? 'checked' : ''} onchange="toggleSignal('${def.id}', this.checked)">
          <span class="sig-toggle-slider"></span>
        </label>
      </div>
    </div>

    <!-- Source + timestamp -->
    <div class="signal-source-row">
      <span><i class="fas fa-circle-nodes"></i> ${def.source}</span>
      <span class="signal-timestamp" id="ts-${def.id}">—</span>
    </div>

    <!-- Value + wave bars -->
    <div class="signal-value-row">
      <div class="signal-val-block">
        <span class="signal-value" id="val-${def.id}">${val}</span>
        <span class="signal-unit">${def.unit}</span>
      </div>
      <div class="waveform signal-wave-indicator ${active ? '' : 'inactive'}" id="wave-${def.id}">
        ${Array(7).fill('<div class="wave-bar"></div>').join('')}
      </div>
    </div>

    <!-- Canvas -->
    <div class="signal-canvas-wrap">
      <canvas id="wf-${def.id}"></canvas>
    </div>

    <!-- Priority bar -->
    <div class="priority-row">
      <span class="priority-label">Prioritas</span>
      <div class="priority-bar-wrap">
        <div class="priority-bar-fill ${priColor}" id="pbar-${def.id}" style="width:${priority}%"></div>
      </div>
      <span class="priority-score ${priColor}" id="pscore-${def.id}">${priority}</span>
      <span class="priority-max">/100</span>
    </div>

    <!-- Thresholds -->
    <div class="signal-threshold-row">
      <div style="display:flex;gap:5px;flex-wrap:wrap">
        ${def.thresholds.map(t =>
          `<span class="threshold-badge ${t.label.toLowerCase()}">${t.label}: ${t.value} ${def.unit}</span>`
        ).join('')}
      </div>
      <span style="font-size:10px;font-family:var(--font-mono);color:var(--text-light)">Maks: ${def.max}</span>
    </div>

    <!-- Stats footer -->
    <div class="signal-stats">
      <div class="signal-stat-item">
        <span class="signal-stat-label">Min</span>
        <span class="signal-stat-val" id="min-${def.id}">—</span>
      </div>
      <div class="signal-stat-item">
        <span class="signal-stat-label">Avg</span>
        <span class="signal-stat-val" id="avg-${def.id}">—</span>
      </div>
      <div class="signal-stat-item">
        <span class="signal-stat-label">Max</span>
        <span class="signal-stat-val" id="max-${def.id}">—</span>
      </div>
      <div class="signal-stat-item">
        <span class="signal-stat-label">Interval</span>
        <span class="signal-stat-val" style="font-size:10px">${def.updateInterval < 1000 ? def.updateInterval+'ms' : (def.updateInterval/1000)+'s'}</span>
      </div>
      ${def.custom ? `
      <div class="signal-stat-item" style="cursor:pointer" onclick="deleteCustomSignal('${def.id}')" title="Hapus sinyal">
        <span class="signal-stat-label">Hapus</span>
        <span class="signal-stat-val" style="color:var(--danger)"><i class="fas fa-trash" style="font-size:11px"></i></span>
      </div>` : ''}
    </div>
  </div>`;
}

/* ============================================================
   CANVAS
   ============================================================ */
function initCanvases() {
  SigState.defs.forEach(def => {
    const canvas = document.getElementById(`wf-${def.id}`);
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W   = Math.max(canvas.parentElement.clientWidth - 28, 100);
    const H   = 100;
    canvas.width  = W * dpr; canvas.height = H * dpr;
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
    SigState.canvases[def.id] = { ctx, W, H };
    drawWaveform(def.id);
  });
}

function drawWaveform(signalId) {
  const def = SigState.defs.find(d => d.id === signalId);
  const p   = SigState.panels[signalId];
  const c   = SigState.canvases[signalId];
  if (!def || !p || !c) return;

  const { ctx, W, H } = c;
  const history = p.history;
  const active  = p.active !== false;
  const color   = active ? statusToColor(p.status, def.color) : '#ADB5BD';

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#F8F9FA'; ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(0,0,0,0.045)'; ctx.lineWidth = 1;
  [0.25, 0.5, 0.75].forEach(r => {
    ctx.beginPath(); ctx.moveTo(0, H*r); ctx.lineTo(W, H*r); ctx.stroke();
  });

  if (history.length < 2) return;
  const range = (def.max - def.min) || 1;
  const toX = i => (i / (history.length-1)) * W;
  const toY = v => H*0.1 + H*0.8 - ((v - def.min) / range) * H*0.8;

  // Inactive: flat line
  if (!active) {
    ctx.beginPath(); ctx.moveTo(0, H*0.5); ctx.lineTo(W, H*0.5);
    ctx.strokeStyle = '#CED4DA'; ctx.lineWidth = 1.5; ctx.stroke();
    return;
  }

  const rv = parseInt(color.slice(1,3),16);
  const gv = parseInt(color.slice(3,5),16);
  const bv = parseInt(color.slice(5,7),16);
  const grad = ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0, `rgba(${rv},${gv},${bv},0.18)`);
  grad.addColorStop(1, `rgba(${rv},${gv},${bv},0)`);

  ctx.beginPath();
  history.forEach((v,i) => { const x=toX(i),y=toY(v); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
  ctx.lineTo(toX(history.length-1),H); ctx.lineTo(0,H); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  ctx.beginPath();
  history.forEach((v,i) => { const x=toX(i),y=toY(v); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
  ctx.strokeStyle=color; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.stroke();

  if (def.thresholds?.length) {
    const tv=def.thresholds[0].value, ty=toY(tv);
    if (ty>4&&ty<H-4) {
      ctx.setLineDash([5,4]); ctx.strokeStyle='rgba(231,76,60,0.55)';
      ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(0,ty); ctx.lineTo(W,ty); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  const lv=history[history.length-1], dotX=W-6, dotY=toY(lv);
  ctx.beginPath(); ctx.arc(dotX,dotY,4.5,0,Math.PI*2);
  ctx.fillStyle=color; ctx.fill();
  ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke();
}

function statusToColor(status, fallback) {
  return { NORMAL:fallback||'#2ECC71', WASPADA:'#F39C12', SIAGA:'#E67E22', BAHAYA:'#E74C3C', KRITIS:'#C0392B', OPTIMAL:fallback||'#2ECC71', RENDAH:'#F39C12' }[status] || fallback;
}

/* ============================================================
   SIGNAL UPDATES
   ============================================================ */
function startAllUpdates() {
  SigState.defs.forEach(def => {
    if (SigState.panels[def.id]?.active !== false) startUpdate(def.id);
  });
}

function startUpdate(signalId) {
  stopUpdate(signalId);
  const def = SigState.defs.find(d => d.id === signalId);
  if (!def) return;
  SigState.timers[signalId] = setInterval(() => tickSignal(signalId), def.updateInterval);
}

function stopUpdate(signalId) {
  if (SigState.timers[signalId]) { clearInterval(SigState.timers[signalId]); delete SigState.timers[signalId]; }
}

function tickSignal(signalId) {
  const def   = SigState.defs.find(d => d.id === signalId);
  const panel = SigState.panels[signalId];
  if (!def || !panel || panel.active === false) return;

  const prev   = panel.currentValue;
  const newVal = generateValue(def, prev);
  panel.prevValue    = prev;
  panel.currentValue = newVal;
  panel.lastUpdate   = Date.now();
  panel.history.push(newVal);
  if (panel.history.length > HISTORY_MAX) panel.history.shift();

  const oldStatus = panel.status;
  panel.status    = determineStatus(def, newVal);
  panel.priority  = calcPriority(def, panel);

  updatePanelDOM(signalId, def, panel, prev);
  drawWaveform(signalId);

  if (oldStatus !== panel.status && panel.status !== 'NORMAL' && panel.status !== 'OPTIMAL') {
    const msg = `${def.name}: ${newVal.toFixed(def.decimals)} ${def.unit}`;
    panel.status === 'BAHAYA' || panel.status === 'KRITIS'
      ? Toast.error(`⚠ ${def.id}: ${panel.status}`, msg, 6000)
      : Toast.warning(`${def.id}: ${panel.status}`, msg, 4000);
  }

  updateStatusSummary();
}

function generateValue(def, current) {
  const drift = (def.baseValue - current) * 0.08;
  const noise = (Math.random() - 0.5) * def.noiseRange;
  if (def.spikeChance && Math.random() < def.spikeChance) {
    const spike = def.thresholds[0]?.value * (1.05 + Math.random() * 0.5) ?? current * 1.5;
    return Math.max(def.min, Math.min(def.max, spike));
  }
  return Math.max(def.min, Math.min(def.max, current + drift + noise));
}

function determineStatus(def, value) {
  const sorted = [...def.thresholds].sort((a,b) => b.value - a.value);
  for (const t of sorted) { if (value >= t.value) return t.label; }
  return 'NORMAL';
}

function calcPriority(def, panel) {
  if (panel.active === false) return 0;
  const base = { NORMAL:8, OPTIMAL:12, WASPADA:45, RENDAH:50, SIAGA:70, BAHAYA:90, KRITIS:95 }[panel.status] ?? 8;
  const thresh = def.thresholds[0]?.value;
  let score = base;
  if (thresh) {
    const ratio = panel.currentValue / thresh;
    score += ratio > 1 ? Math.min(10, (ratio-1)*15) : -(1-ratio)*8;
  }
  score += (Math.random()-0.5)*4;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/* ============================================================
   DOM UPDATE
   ============================================================ */
function updatePanelDOM(signalId, def, panel, prev) {
  const { currentValue, status, active, priority, lastUpdate } = panel;

  // Value
  const vEl = document.getElementById(`val-${signalId}`);
  if (vEl) {
    vEl.textContent = currentValue.toFixed(def.decimals);
    const dir = currentValue > prev+0.001?'up':currentValue<prev-0.001?'down':'';
    vEl.className = `signal-value${dir?' '+dir:''}`;
    if (dir) setTimeout(()=>{ if(vEl) vEl.className='signal-value'; }, 700);
  }

  // Badge
  const bEl = document.getElementById(`status-${signalId}`);
  if (bEl) { bEl.textContent = active?status:'NONAKTIF'; bEl.className = `signal-status-badge ${active?status.toLowerCase():'inactive'}`; }

  // Panel data-status
  const pEl = document.getElementById(`panel-${signalId}`);
  if (pEl) pEl.dataset.status = active?status.toLowerCase():'inactive';

  // Timestamp
  const tEl = document.getElementById(`ts-${signalId}`);
  if (tEl && lastUpdate) tEl.textContent = formatTimeAgo(lastUpdate);

  // Priority
  const pbEl = document.getElementById(`pbar-${signalId}`);
  const psEl = document.getElementById(`pscore-${signalId}`);
  if (pbEl) { const c=priority>=70?'high':priority>=40?'medium':'low'; pbEl.className=`priority-bar-fill ${c}`; pbEl.style.width=`${priority}%`; }
  if (psEl) { const c=priority>=70?'high':priority>=40?'medium':'low'; psEl.textContent=priority; psEl.className=`priority-score ${c}`; }

  // Stats
  const h = panel.history;
  if (h.length) {
    const min = Math.min(...h).toFixed(def.decimals);
    const max = Math.max(...h).toFixed(def.decimals);
    const avg = (h.reduce((a,b)=>a+b,0)/h.length).toFixed(def.decimals);
    ['min','avg','max'].forEach((k,i) => {
      const el=document.getElementById(`${k}-${signalId}`);
      if (el) el.textContent=[min,avg,max][i];
    });
  }
}

/* ============================================================
   TOGGLE AKTIF / NONAKTIF
   ============================================================ */
function toggleSignal(signalId, active) {
  const panel = SigState.panels[signalId];
  if (!panel) return;
  panel.active = active;
  AppStorage.signals.setActiveState(signalId, active);

  if (active) {
    startUpdate(signalId);
    panel.lastUpdate = Date.now();
  } else {
    stopUpdate(signalId);
    panel.status   = 'NORMAL';
    panel.priority = 0;
  }

  const pEl = document.getElementById(`panel-${signalId}`);
  if (pEl) {
    pEl.classList.toggle('inactive', !active);
    pEl.dataset.status = active ? (panel.status?.toLowerCase()||'normal') : 'inactive';
  }
  const waveEl = document.getElementById(`wave-${signalId}`);
  if (waveEl) waveEl.classList.toggle('inactive', !active);

  updatePanelDOM(signalId, SigState.defs.find(d=>d.id===signalId), panel, panel.currentValue);
  drawWaveform(signalId);
  updateStatusSummary();

  Toast.info(`Sinyal ${active?'Diaktifkan':'Dinonaktifkan'}`, SigState.defs.find(d=>d.id===signalId)?.name);
}

/* ============================================================
   STATUS SUMMARY
   ============================================================ */
function updateStatusSummary() {
  const counts = { NORMAL:0, WASPADA:0, SIAGA:0, BAHAYA:0, NONAKTIF:0 };
  Object.values(SigState.panels).forEach(p => {
    if (!p.active) { counts.NONAKTIF++; return; }
    const k = ['BAHAYA','KRITIS'].includes(p.status)?'BAHAYA':['SIAGA','RENDAH'].includes(p.status)?'SIAGA':p.status==='WASPADA'?'WASPADA':'NORMAL';
    counts[k] = (counts[k]||0)+1;
  });
  ['normal','waspada','siaga','bahaya','nonaktif'].forEach(k=>{
    const el=document.getElementById(`count-${k}`);
    if (el) el.textContent=counts[k.toUpperCase()]||0;
  });
}

/* ============================================================
   FILTER
   ============================================================ */
function filterSignals(filter) {
  document.querySelectorAll('.filter-tab').forEach(t=>t.classList.toggle('active',t.dataset.filter===filter));
  document.querySelectorAll('.signal-panel').forEach(p=>{
    const show = filter==='all' || p.dataset.status===filter || p.dataset.type===filter;
    p.style.display = show?'':'none';
  });
}

/* ============================================================
   ADD SIGNAL MODAL
   ============================================================ */
function showAddSignalModal() {
  document.getElementById('add-signal-modal')?.classList.remove('hidden');
}

function hideAddSignalModal() {
  document.getElementById('add-signal-modal')?.classList.add('hidden');
  document.getElementById('add-signal-form')?.reset();
}

function submitAddSignal() {
  const name  = document.getElementById('f-name')?.value.trim();
  const type  = document.getElementById('f-type')?.value;
  const src   = document.getElementById('f-source')?.value.trim() || 'Manual Input';
  const unit  = document.getElementById('f-unit')?.value.trim() || '-';
  const val   = parseFloat(document.getElementById('f-value')?.value) || 0;
  const tWarn = parseFloat(document.getElementById('f-thresh-warn')?.value) || null;
  const tBad  = parseFloat(document.getElementById('f-thresh-bad')?.value)  || null;

  if (!name) { Toast.error('Form Tidak Lengkap','Nama sinyal wajib diisi'); return; }

  const newDef = {
    id:          `CUSTOM-${Date.now()}`,
    name, type, source: src, unit,
    icon:         { sensor:'fa-wave-square', visual:'fa-camera', sosmed:'fa-hashtag', ops:'fa-gear' }[type] || 'fa-signal',
    color:        '#6C757D',
    decimals:     1,
    baseValue:    val,
    noiseRange:   val * 0.1 || 5,
    min:          0,
    max:          val * 3 || 100,
    thresholds:   [
      ...(tWarn ? [{ value:tWarn, label:'WASPADA' }] : []),
      ...(tBad  ? [{ value:tBad,  label:'BAHAYA'  }] : []),
    ],
    updateInterval: 5000,
    spikeChance:  0,
    custom: true,
  };

  AppStorage.signals.addCustom(newDef);
  SigState.defs.push(newDef);

  SigState.panels[newDef.id] = {
    currentValue: val, prevValue: val,
    history: buildInitialHistory(newDef),
    status: 'NORMAL', active: true,
    priority: 5, lastUpdate: Date.now(),
  };

  const grid = document.getElementById('signal-grid');
  if (grid) grid.insertAdjacentHTML('beforeend', buildPanelHTML(newDef));

  requestAnimationFrame(() => {
    const canvas = document.getElementById(`wf-${newDef.id}`);
    if (canvas) {
      const dpr=window.devicePixelRatio||1, W=canvas.parentElement.clientWidth-28, H=100;
      canvas.width=W*dpr; canvas.height=H*dpr;
      canvas.style.width=`${W}px`; canvas.style.height=`${H}px`;
      const ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr);
      SigState.canvases[newDef.id]={ctx,W,H};
      drawWaveform(newDef.id);
    }
    startUpdate(newDef.id);
  });

  updateStatusSummary();
  hideAddSignalModal();
  Toast.success('Sinyal Ditambahkan', `"${name}" berhasil ditambahkan`);
}

function deleteCustomSignal(signalId) {
  showConfirm('Hapus sinyal ini?', () => {
    stopUpdate(signalId);
    AppStorage.signals.removeCustom(signalId);
    delete SigState.panels[signalId];
    delete SigState.canvases[signalId];
    SigState.defs = SigState.defs.filter(d=>d.id!==signalId);
    document.getElementById(`panel-${signalId}`)?.remove();
    updateStatusSummary();
    Toast.info('Sinyal Dihapus','Panel sinyal custom berhasil dihapus');
  });
}

/* ============================================================
   LOCAL STORAGE
   ============================================================ */
function loadFromStorage() {
  const activeStates = AppStorage.signals.getActiveStates();

  SigState.defs.forEach(def => {
    const history  = AppStorage.signals.getHistory(def.id);
    const initHist = history.length >= 5 ? history : buildInitialHistory(def);
    const active   = activeStates[def.id] !== false;

    SigState.panels[def.id] = {
      currentValue: initHist[initHist.length-1] ?? def.baseValue,
      prevValue:    def.baseValue,
      history:      initHist,
      status:       'NORMAL',
      active,
      priority:     10,
      lastUpdate:   null,
    };
    const p = SigState.panels[def.id];
    p.status   = determineStatus(def, p.currentValue);
    p.priority = calcPriority(def, p);
  });
}

function buildInitialHistory(def) {
  let v = def.baseValue;
  return Array.from({length:HISTORY_MAX}, () => {
    v = Math.max(def.min, Math.min(def.max, v+(def.baseValue-v)*0.1+(Math.random()-0.5)*def.noiseRange));
    return v;
  });
}

function saveToStorage() {
  SigState.defs.forEach(def => {
    AppStorage.signals.saveHistory(def.id, SigState.panels[def.id]?.history || []);
  });
  const el=document.getElementById('last-saved');
  const t=new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
  if (el) el.textContent=`Tersimpan: ${t} · Cache: ${AppStorage.sizeKB()} KB`;
  Toast.success('Cache Tersimpan', `Data sinyal & ${AppStorage.sizeKB()} KB tersimpan`);
}

function autoSave() { AppStorage.signals.getCustom(); saveToStorage(); }

function clearHistory() {
  showConfirm('Hapus semua riwayat sinyal dari cache?', () => {
    AppStorage.signals.clearHistory();
    SigState.defs.forEach(def=>{ if(SigState.panels[def.id]) SigState.panels[def.id].history=buildInitialHistory(def); });
    document.getElementById('last-saved').textContent='Riwayat dihapus';
    Toast.info('Cache Dihapus','Riwayat sinyal direset');
  });
}

function exportSignalCSV() {
  const rows = ['ID,Nama,Tipe,Nilai,Satuan,Status,Prioritas,Sumber'];
  SigState.defs.forEach(def=>{
    const p=SigState.panels[def.id]; if(!p) return;
    rows.push([def.id,`"${def.name}"`,def.type,p.currentValue.toFixed(def.decimals),def.unit,p.status,p.priority,`"${def.source}"`].join(','));
  });
  const blob=new Blob([rows.join('\n')],{type:'text/csv'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`drcc_signals_${Date.now()}.csv`; a.click();
  Toast.success('CSV Diunduh',`${rows.length-1} sinyal diekspor`);
}

/* ============================================================
   EXPOSE
   ============================================================ */
Object.assign(window, {
  initSignals, filterSignals, toggleSignal,
  showAddSignalModal, hideAddSignalModal, submitAddSignal, deleteCustomSignal,
  saveToStorage, clearHistory, exportSignalCSV,
});
