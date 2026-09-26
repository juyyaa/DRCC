/* ============================================
   DRCC — ai-command.js
   AI Command Panel: agents, form, output, history, export
   ============================================ */
'use strict';

/* ---- AGENT DEFINITIONS ---- */
const AGENTS = [
  { id:'aria',  code:'ARIA',  title:'Situation Analyst',     icon:'fa-shield-halved',  color:'#B5651D', desc:'Menganalisis situasi & dampak bencana secara komprehensif.' },
  { id:'logi',  code:'LOGI',  title:'Logistics Prioritizer', icon:'fa-boxes-stacking', color:'#2980B9', desc:'Menghitung kebutuhan & distribusi logistik darurat.' },
  { id:'recon', code:'RECON', title:'Response Commander',    icon:'fa-people-arrows',  color:'#27AE60', desc:'Merencanakan rute evakuasi & koordinasi tim respons.' },
  { id:'pulse', code:'PULSE', title:'Public Alert',          icon:'fa-bullhorn',       color:'#9B59B6', desc:'Menentukan level siaga & rekomendasi komunikasi publik.' },
];

const PROVINCES = [
  'Aceh','Sumatera Utara','Sumatera Barat','Riau','Kepulauan Riau','Jambi',
  'Sumatera Selatan','Bangka Belitung','Bengkulu','Lampung',
  'DKI Jakarta','Jawa Barat','Banten','Jawa Tengah','DI Yogyakarta','Jawa Timur',
  'Bali','Nusa Tenggara Barat','Nusa Tenggara Timur',
  'Kalimantan Barat','Kalimantan Tengah','Kalimantan Selatan','Kalimantan Timur','Kalimantan Utara',
  'Sulawesi Utara','Sulawesi Tengah','Sulawesi Selatan','Sulawesi Tenggara','Gorontalo','Sulawesi Barat',
  'Maluku','Maluku Utara','Papua','Papua Barat',
];

const TYPE_LABELS = { gempa:'Gempa Bumi', banjir:'Banjir', longsor:'Tanah Longsor', kebakaran:'Kebakaran' };
const TYPE_UNITS  = { gempa:'SR', banjir:'m', longsor:'m³', kebakaran:'ha' };
const MAG_CFG     = {
  gempa:     { label:'Magnitudo (SR)',      hint:'Skala Richter 0–9',            min:.1, max:9,    step:.1, def:5.0  },
  banjir:    { label:'Ketinggian Air (m)',  hint:'Tinggi genangan dalam meter',  min:.1, max:10,   step:.1, def:1.5  },
  longsor:   { label:'Volume Longsor (m³)', hint:'Estimasi volume material',     min:10, max:10000,step:10, def:1000 },
  kebakaran: { label:'Luas Terbakar (ha)',  hint:'Luas area terbakar hektar',    min:1,  max:10000,step:10, def:100  },
};
const SEV_COLOR = { BAHAYA:'#E74C3C', SIAGA:'#E67E22', WASPADA:'#F39C12', NORMAL:'#27AE60' };
const SEV_BG    = { BAHAYA:'#FADBD8', SIAGA:'#FAE5D3', WASPADA:'#FDEBD0', NORMAL:'#D5F5E3' };

const STORAGE_KEY = 'drcc_ai_history';
let aiHistory     = [];
let lastAnalysis  = null;

/* ============================================================
   INIT
   ============================================================ */
function initAICommand() {
  buildAppShell('ai-command', 'AI Command Panel', 'Analisis dan rekomendasi berbasis AI');
  buildProvinces();
  renderAgentCards('idle');
  loadHistory();
  renderHistory();
}

function buildProvinces() {
  const sel = document.getElementById('f-lokasi');
  if (!sel) return;
  PROVINCES.forEach(p => sel.insertAdjacentHTML('beforeend', `<option value="${p}">${p}</option>`));
}

/* ============================================================
   AGENT CARDS
   ============================================================ */
function renderAgentCards(state, results = {}) {
  AGENTS.forEach(ag => {
    const el   = document.getElementById(`agent-${ag.id}`);
    const sEl  = el?.querySelector('.agent-status');
    const cEl  = el?.querySelector('.agent-conf');
    const iEl  = el?.querySelector('.agent-icon-inner');
    if (!el) return;

    if (state === 'processing' && results[ag.id] === 'processing') {
      el.dataset.state = 'processing';
      if (sEl)  sEl.innerHTML  = `<i class="fas fa-circle-notch anim-spin"></i> Memproses...`;
      if (sEl)  sEl.className  = 'agent-status processing';
      if (iEl)  iEl.style.animation = 'pulse 1s infinite';
    } else if (state === 'done' || results[ag.id] === 'done') {
      const conf = results[ag.id + '_conf'] || 88;
      el.dataset.state = 'done';
      if (sEl)  { sEl.innerHTML = `<i class="fas fa-circle-check"></i> Selesai · ${conf}%`; sEl.className = 'agent-status done'; }
      if (cEl)  cEl.textContent = `${conf}%`;
      if (iEl)  iEl.style.animation = '';
    } else {
      el.dataset.state = 'idle';
      if (sEl)  { sEl.innerHTML = `<i class="fas fa-circle"></i> Standby`; sEl.className = 'agent-status idle'; }
      if (cEl)  cEl.textContent = '—';
      if (iEl)  iEl.style.animation = '';
    }
  });
}

/* ============================================================
   FORM HELPERS
   ============================================================ */
function updateMagnitudeLabel() {
  const type = document.getElementById('f-jenis')?.value || 'gempa';
  const cfg  = MAG_CFG[type] || MAG_CFG.gempa;
  const lbl  = document.getElementById('mag-label');
  const hint = document.getElementById('mag-hint');
  const inp  = document.getElementById('f-magnitude');
  if (lbl)  lbl.textContent  = cfg.label;
  if (hint) hint.textContent = cfg.hint;
  if (inp)  { inp.min=cfg.min; inp.max=cfg.max; inp.step=cfg.step; inp.value=cfg.def; }
}

/* ============================================================
   RUN ANALYSIS
   ============================================================ */
async function runAIAnalysis() {
  const input = {
    location:   document.getElementById('f-lokasi')?.value,
    type:       document.getElementById('f-jenis')?.value   || 'gempa',
    magnitude:  parseFloat(document.getElementById('f-magnitude')?.value) || 0,
    population: parseInt(document.getElementById('f-populasi')?.value)    || 0,
    days:       parseInt(document.getElementById('f-days')?.value)        || 7,
  };

  if (!input.location || !input.magnitude || !input.population) {
    Toast.error('Data Tidak Lengkap','Isi semua field yang wajib diisi'); return;
  }
  if (input.population < 10 || input.population > 50000000) {
    Toast.error('Populasi Tidak Valid','Masukkan jumlah populasi yang realistis (10 – 50,000,000)'); return;
  }

  const btn = document.getElementById('btn-analyze');
  if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-circle-notch anim-spin"></i> Menganalisis...'; }

  document.getElementById('output-panel')?.classList.add('hidden');

  /* ── Sequential agent animation ── */
  const delays = [0, 850, 1650, 2400];
  const agStates = {};

  AGENTS.forEach((ag, i) => {
    setTimeout(() => {
      agStates[ag.id] = 'processing';
      renderAgentCards('processing', agStates);
    }, delays[i]);
  });

  await new Promise(r => setTimeout(r, 3300));

  /* ── Compute ── */
  const risk      = AIEngine.calcRisk(input);
  const area      = AIEngine.calcArea(input);
  const cas       = AIEngine.calcCasualties({ ...input, area: area.km2 });
  const priority  = AIEngine.calcAidPriority({ ...input, casualties: cas });
  const evac      = AIEngine.calcEvacuation(input);
  const logistics = AIEngine.calcLogistics(input);

  const confs = { aria:90+~~(Math.random()*8), logi:86+~~(Math.random()*9), recon:83+~~(Math.random()*10), pulse:88+~~(Math.random()*8) };
  const doneStates = {};
  AGENTS.forEach(ag => { doneStates[ag.id]='done'; doneStates[ag.id+'_conf']=confs[ag.id]; });
  renderAgentCards('done', doneStates);

  lastAnalysis = { id:Date.now(), input, risk, area, cas, priority, evac, logistics, confs, ts:Date.now() };
  renderOutput(lastAnalysis);
  saveHistory(lastAnalysis);
  renderHistory();

  if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-brain"></i> Analisis AI'; }
  Toast.success('Analisis Selesai', `Risk ${risk.score}/100 — Level: ${risk.level}`);
}

/* ============================================================
   RENDER OUTPUT
   ============================================================ */
function renderOutput(a) {
  const { input, risk, area, cas, priority, evac, logistics } = a;
  const panel = document.getElementById('output-panel');
  if (!panel) return;

  const sc = SEV_COLOR[risk.level] || '#6C757D';
  const sb = SEV_BG[risk.level]    || '#F8F9FA';
  const fN = n => formatNumber(n);
  const unit = TYPE_UNITS[input.type] || '';

  panel.innerHTML = `

    <!-- 1. Risk Score -->
    <div class="ai-out-card anim-fade-in-up" style="--delay:.05s">
      <div class="ai-out-header" style="background:${sc}">
        <i class="fas fa-gauge-high"></i> Risk Escalation Alert
        <span class="ai-out-tag">${risk.level}</span>
      </div>
      <div class="ai-out-body">
        <div style="display:flex;align-items:center;gap:20px">
          <div style="text-align:center;flex-shrink:0">
            <div style="font-size:52px;font-weight:900;color:${sc};line-height:1">${risk.score}</div>
            <div style="font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase">/100 Risk Score</div>
          </div>
          <div style="flex:1">
            <div style="height:10px;background:var(--border);border-radius:5px;overflow:hidden;margin-bottom:10px">
              <div style="height:100%;width:${risk.score}%;background:${sc};border-radius:5px;transition:width 1.2s ease"></div>
            </div>
            <p style="font-size:12px;color:var(--text-muted);line-height:1.6;margin:0">
              ${risk.label}. Berdasarkan data <strong>${input.location}</strong> —
              ${TYPE_LABELS[input.type]||input.type} intensitas
              <strong>${input.magnitude} ${unit}</strong>,
              populasi terdampak <strong>${fN(input.population)} jiwa</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. Three-column: Area | Casualties | Aid Priority -->
    <div class="ai-out-3col">

      <!-- Affected Area -->
      <div class="ai-out-card anim-fade-in-up" style="--delay:.15s">
        <div class="ai-out-header" style="background:#2980B9">
          <i class="fas fa-map-location-dot"></i> Affected Area
        </div>
        <div class="ai-out-body">
          <div style="font-size:36px;font-weight:900;color:#2980B9;line-height:1">${fN(area.km2)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px;font-weight:600">km² terdampak</div>
          <div style="font-size:12px;color:var(--text);line-height:1.8">
            <div>≈ ${fN(area.ha)} hektar</div>
            <div>Radius ~${area.radius} km</div>
            <div>${fN(input.population)} jiwa terancam</div>
          </div>
        </div>
      </div>

      <!-- Casualty Forecast -->
      <div class="ai-out-card anim-fade-in-up" style="--delay:.25s">
        <div class="ai-out-header" style="background:#E74C3C">
          <i class="fas fa-user-injured"></i> Casualty Forecast
        </div>
        <div class="ai-out-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
            ${[['Luka Ringan',cas.light,'#F39C12'],['Luka Berat',cas.severe,'#E74C3C'],['Hilang',cas.missing,'#9B59B6'],['Est. Korban',cas.dead,'#922B21']].map(([l,v,c])=>`
            <div style="background:var(--bg);border-radius:8px;padding:8px;text-align:center">
              <div style="font-size:22px;font-weight:900;color:${c}">${fN(v)}</div>
              <div style="font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase">${l}</div>
            </div>`).join('')}
          </div>
          <p style="font-size:10px;color:var(--text-light);margin:0">* Estimasi model statistik historis</p>
        </div>
      </div>

      <!-- Aid Priority -->
      <div class="ai-out-card anim-fade-in-up" style="--delay:.35s">
        <div class="ai-out-header" style="background:#B5651D">
          <i class="fas fa-list-ol"></i> Aid Priority Ranking
        </div>
        <div class="ai-out-body" style="padding:10px 14px">
          ${priority.slice(0,6).map((p,i)=>`
          <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:11px;font-weight:900;color:${i<2?'#E74C3C':i<4?'#F39C12':'#6C757D'};min-width:16px">#${i+1}</span>
            <span style="font-size:12px;flex:1;color:var(--text)">${p.item}</span>
            <span style="font-size:10px;font-weight:700;color:var(--text-muted);font-family:monospace">${p.score}</span>
          </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- 3. Evacuation Routes -->
    <div class="ai-out-card anim-fade-in-up" style="--delay:.45s">
      <div class="ai-out-header" style="background:#27AE60">
        <i class="fas fa-route"></i> Evacuation Route Recommendation
      </div>
      <div class="ai-out-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <div>
            <div class="ai-out-label">Jalur Utama</div>
            <p style="font-size:13px;color:var(--text);line-height:1.6;margin-bottom:10px">${evac.primary}</p>
            <div class="ai-out-label">Arah Evakuasi</div>
            <p style="font-size:13px;color:var(--text);margin-bottom:10px">${evac.direction}</p>
            <div class="ai-out-label">Waktu Eksekusi</div>
            <p style="font-size:13px;color:var(--text)">${evac.time}</p>
          </div>
          <div>
            <div class="ai-out-label">Jalur Alternatif</div>
            <p style="font-size:13px;color:var(--text);line-height:1.6;margin-bottom:10px">${evac.alternate}</p>
            <div class="ai-out-label">Zona Terlarang</div>
            <p style="font-size:13px;color:#E74C3C;line-height:1.6">${evac.avoid}</p>
          </div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
          <span class="ai-chip"><i class="fas fa-people-arrows"></i> ${evac.teams} Tim</span>
          <span class="ai-chip"><i class="fas fa-truck"></i> ${evac.vehicles} Kendaraan</span>
          <span class="ai-chip"><i class="fas fa-location-dot"></i> ${evac.location}</span>
        </div>
      </div>
    </div>

    <!-- 4. Logistics Distribution Plan -->
    <div class="ai-out-card anim-fade-in-up" style="--delay:.55s">
      <div class="ai-out-header" style="background:#7D4E25">
        <i class="fas fa-truck-ramp-box"></i> Logistics Distribution Plan
        <span style="margin-left:auto;font-size:11px;opacity:.8">${logistics.days} hari ke depan</span>
      </div>
      <div class="ai-out-body">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
          ${[
            {t:'Pangan & Air',      c:'#E67E22',i:'fa-wheat-awn',     rows:[['Beras',fN(logistics.food.rice)+' kg'],['Air Bersih',fN(logistics.food.water)+' L'],['Nasi Bungkus',fN(logistics.food.readyMeal)+' pak']]},
            {t:'Tenaga Medis',      c:'#E74C3C',i:'fa-user-nurse',    rows:[['Dokter',logistics.medical.doctors+' org'],['Perawat',logistics.medical.nurses+' org'],['Kit P3K',fN(logistics.medical.kits)+' set'],['Ambulans',logistics.medical.ambulances+' unit']]},
            {t:'Shelter',          c:'#2980B9',i:'fa-tent',           rows:[['Tenda',fN(logistics.shelter.tents)+' unit'],['Selimut',fN(logistics.shelter.blankets)+' lbr'],['Kasur',fN(logistics.shelter.mattresses)+' unit']]},
            {t:'Transportasi',     c:'#27AE60',i:'fa-truck',          rows:[['Truk',logistics.transport.trucks+' unit'],['Bus',logistics.transport.buses+' unit'],['Helikopter',logistics.transport.helicopters+' unit']]},
          ].map(cat=>`
          <div style="background:var(--bg);border-radius:8px;padding:10px">
            <div style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:800;color:${cat.c};margin-bottom:8px">
              <i class="fas ${cat.i}"></i> ${cat.t}
            </div>
            ${cat.rows.map(([k,v])=>`
            <div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid rgba(0,0,0,.05)">
              <span style="color:var(--text-muted)">${k}</span>
              <strong style="color:var(--text)">${v}</strong>
            </div>`).join('')}
          </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- Export -->
    <div style="display:flex;justify-content:flex-end;gap:8px;padding-top:4px">
      <button class="btn btn-secondary btn-sm" onclick="exportRecommendation()" type="button">
        <i class="fas fa-file-lines"></i> Export Rekomendasi ke Teks
      </button>
    </div>`;

  panel.classList.remove('hidden');
  setTimeout(() => panel.scrollIntoView({ behavior:'smooth', block:'nearest' }), 100);
}

/* ============================================================
   HISTORY
   ============================================================ */
function loadHistory() {
  aiHistory = AppStorage.get(STORAGE_KEY, []);
}

function saveHistory(a) {
  aiHistory.unshift(a);
  if (aiHistory.length > 20) aiHistory.pop();
  AppStorage.set(STORAGE_KEY, aiHistory);
}

function renderHistory() {
  const list = document.getElementById('history-list');
  if (!list) return;
  const cnt  = document.getElementById('history-count');
  if (cnt) cnt.textContent = aiHistory.length;

  if (!aiHistory.length) {
    list.innerHTML = `<div class="empty-state" style="padding:24px 16px"><i class="fas fa-history"></i><h3>Belum Ada Riwayat</h3><p>Jalankan analisis untuk melihat riwayat.</p></div>`;
    return;
  }

  list.innerHTML = aiHistory.map((a, idx) => {
    const sc = SEV_COLOR[a.risk.level] || '#6C757D';
    return `
    <div class="history-item" onclick="loadHistoryItem(${a.id})">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
        <span style="font-size:10px;font-weight:800;color:var(--text-muted);font-family:monospace">#${String(idx+1).padStart(3,'0')}</span>
        <span style="font-size:11px;font-weight:800;color:${sc}">${a.risk.level}</span>
        <span style="font-size:11px;font-weight:800;color:var(--text);margin-left:auto;font-family:monospace">${a.risk.score}<span style="font-weight:400;color:var(--text-muted)">/100</span></span>
      </div>
      <div style="font-size:12px;font-weight:700;color:var(--text)">
        ${a.input.location} · ${TYPE_LABELS[a.input.type]||a.input.type} ${a.input.magnitude}${TYPE_UNITS[a.input.type]||''}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:3px">
        <span style="font-size:10px;color:var(--text-light)">${formatDateTime(a.ts)}</span>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();exportById(${a.id})" style="padding:2px 6px;font-size:10px" title="Export">
          <i class="fas fa-download"></i>
        </button>
      </div>
    </div>`;
  }).join('');
}

function loadHistoryItem(id) {
  const a = aiHistory.find(h => h.id === id);
  if (!a) return;
  lastAnalysis = a;
  renderOutput(a);
  // Restore agent cards to done state
  const ds = {};
  AGENTS.forEach(ag => { ds[ag.id]='done'; ds[ag.id+'_conf']=a.confs?.[ag.id]||88; });
  renderAgentCards('done', ds);
  Toast.info('Riwayat Dimuat', `${a.input.location} · Risk ${a.risk.score}/100`);
}

function clearHistory() {
  showConfirm('Hapus semua riwayat analisis AI?', () => {
    aiHistory = [];
    AppStorage.remove(STORAGE_KEY);
    renderHistory();
    renderAgentCards('idle');
    document.getElementById('output-panel')?.classList.add('hidden');
    Toast.info('Riwayat Dihapus','Cache analisis AI dihapus');
  });
}

/* ============================================================
   EXPORT TO TEXT
   ============================================================ */
function exportRecommendation() { if (lastAnalysis) exportById(lastAnalysis.id); else Toast.error('Tidak Ada Data','Jalankan analisis terlebih dahulu'); }
function exportById(id) {
  const a = aiHistory.find(h => h.id === id) || (lastAnalysis?.id === id ? lastAnalysis : null);
  if (!a) return;
  const { input, risk, area, cas, priority, evac, logistics } = a;
  const fN = n => formatNumber(n);
  const u  = TYPE_UNITS[input.type] || '';
  const lines = [
    '================================================',
    '  DRCC — AI COMMAND LAPORAN REKOMENDASI',
    '================================================',
    `ID        : ${a.id}`,
    `Timestamp : ${formatDateTime(a.ts)}`,
    `Dihasilkan: DRCC AI Command v1.0`,
    '',
    '[ INPUT DATA BENCANA ]',
    `Lokasi            : ${input.location}`,
    `Jenis Bencana     : ${TYPE_LABELS[input.type]||input.type}`,
    `Intensitas        : ${input.magnitude} ${u}`,
    `Populasi Terdampak: ${fN(input.population)} jiwa`,
    `Periode Logistik  : ${input.days} hari`,
    '',
    '[ RISK ESCALATION ALERT ]',
    `Risk Score : ${risk.score}/100`,
    `Alert Level: ${risk.level}`,
    `Keterangan : ${risk.label}`,
    '',
    '[ AFFECTED AREA ]',
    `Luas Terdampak: ~${fN(area.km2)} km² (~${fN(area.ha)} ha)`,
    `Radius Dampak : ~${area.radius} km`,
    '',
    '[ CASUALTY FORECAST ]',
    `Luka Ringan   : ~${fN(cas.light)} jiwa`,
    `Luka Berat    : ~${fN(cas.severe)} jiwa`,
    `Hilang        : ~${fN(cas.missing)} jiwa`,
    `Est. Korban   : ~${fN(cas.dead)} jiwa`,
    '',
    '[ AID PRIORITY RANKING ]',
    ...priority.slice(0,8).map((p,i)=>`  #${i+1}. ${p.item.padEnd(35)} (skor: ${p.score})`),
    '',
    '[ EVACUATION ROUTE ]',
    `Jalur Utama  : ${evac.primary}`,
    `Jalur Alt.   : ${evac.alternate}`,
    `Hindari      : ${evac.avoid}`,
    `Waktu        : ${evac.time}`,
    `Arah         : ${evac.direction}`,
    `Tim Evakuasi : ${evac.teams} tim | ${evac.vehicles} kendaraan`,
    '',
    '[ LOGISTICS DISTRIBUTION PLAN ]',
    `-- Pangan (${input.days} hari) --`,
    `   Beras    : ${fN(logistics.food.rice)} kg`,
    `   Air      : ${fN(logistics.food.water)} L`,
    `   Nasi     : ${fN(logistics.food.readyMeal)} bungkus`,
    `-- Medis --`,
    `   Dokter   : ${logistics.medical.doctors} org | Perawat: ${logistics.medical.nurses} org`,
    `   Kit P3K  : ${fN(logistics.medical.kits)} set | Ambulans: ${logistics.medical.ambulances}`,
    `-- Shelter --`,
    `   Tenda    : ${fN(logistics.shelter.tents)} unit | Selimut: ${fN(logistics.shelter.blankets)}`,
    `-- Transportasi --`,
    `   Truk     : ${logistics.transport.trucks} | Bus: ${logistics.transport.buses} | Heli: ${logistics.transport.helicopters}`,
    '',
    '================================================',
  ];
  const blob = new Blob([lines.join('\n')], { type:'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `DRCC_AI_${(input.location||'').replace(/\s+/g,'_')}_${a.id}.txt`;
  link.click();
  URL.revokeObjectURL(url);
  Toast.success('Export Berhasil','Laporan rekomendasi disimpan sebagai .txt');
}

Object.assign(window, {
  initAICommand, runAIAnalysis, updateMagnitudeLabel,
  loadHistoryItem, clearHistory, exportRecommendation, exportById,
});
