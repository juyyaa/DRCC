/* ============================================
   DRCC — history.js
   Riwayat semua alert, insiden, AI, peta
   Filter by tanggal/jenis/level, pagination, export CSV
   ============================================ */
'use strict';

let histAll      = [];
let histFiltered = [];
let histPage     = 1;
const PER_PAGE   = 10;
let hFilter = { type:'all', level:'all', search:'', dateFrom:'', dateTo:'' };

/* ============================================================ INIT */
function initHistory() {
  buildAppShell('history', 'Riwayat Aktivitas', 'Log lengkap semua alert, insiden, dan analisis AI');
  aggregateHistory();
  applyHistFilter();
  renderHistStats();
}

/* ============================================================ AGGREGATE DATA */
function aggregateHistory() {
  histAll = [];

  /* 1. Incidents */
  AppStorage.get('drcc_incidents', []).forEach(inc => histAll.push({
    ts:     inc.createdAt || Date.now(),
    type:   'insiden',
    level:  inc.severity  || 'NORMAL',
    title:  inc.title,
    source: `${inc.location||''}, ${inc.province||''}`,
    detail: `${inc.type||''} · Status: ${inc.status||''} · ${formatNumber(inc.affected||0)} terdampak`,
    id:     inc.id,
  }));

  /* 2. AI Analysis history */
  AppStorage.get('drcc_ai_history', []).forEach(a => histAll.push({
    ts:     a.ts || Date.now(),
    type:   'ai',
    level:  a.risk?.level || 'NORMAL',
    title:  `Analisis AI: ${a.input?.location || '—'}`,
    source: 'AI Command Panel',
    detail: `${a.input?.type||''} · Magnitude ${a.input?.magnitude} · Risk Score ${a.risk?.score}/100`,
    id:     String(a.id),
  }));

  /* 3. Custom map markers */
  AppStorage.get('drcc_map_markers', []).forEach(m => histAll.push({
    ts:     m.date ? new Date(m.date+'T00:00:00').getTime() : Date.now(),
    type:   'peta',
    level:  m.severity || 'NORMAL',
    title:  `Marker: ${m.name}`,
    source: 'Situation Map',
    detail: `Tipe: ${m.type||'—'} · Koordinat: ${(m.lat||0).toFixed(4)}, ${(m.lng||0).toFixed(4)}`,
    id:     m.id,
  }));

  /* 4. Resources changes */
  AppStorage.get('drcc_resources', []).filter(r => r.assignedTo).forEach(r => histAll.push({
    ts:     r.updatedAt || Date.now(),
    type:   'sumberdaya',
    level:  'INFO',
    title:  `Penugasan: ${r.name}`,
    source: 'Manajemen Sumber Daya',
    detail: `${r.type} · Status: ${r.status} · Ditugaskan ke ${r.assignedTo}`,
    id:     r.id,
  }));

  /* 5. Signals cache (summary entry) */
  const sigHist = AppStorage.get('drcc_signals_history', []);
  if (sigHist?.length) histAll.push({
    ts:     Date.now() - 3600000,
    type:   'sinyal',
    level:  'INFO',
    title:  'Riwayat Sinyal Tersimpan',
    source: 'Signal Monitor',
    detail: `${sigHist.length} dataset sinyal tersimpan di cache`,
    id:     'sig-cache',
  });

  /* Sort newest first */
  histAll = Helpers.sortBy(histAll, 'ts', 'desc');
}

function renderHistStats() {
  const s = (id, v) => Helpers.setInnerText(id, v);
  s('hs-total',    histAll.length);
  s('hs-insiden',  histAll.filter(h=>h.type==='insiden').length);
  s('hs-ai',       histAll.filter(h=>h.type==='ai').length);
  s('hs-peta',     histAll.filter(h=>h.type==='peta').length);
  s('hs-bahaya',   histAll.filter(h=>h.level==='BAHAYA').length);
}

/* ============================================================ FILTER */
function applyHistFilter() {
  histFiltered = histAll.filter(h => {
    const { type, level, search, dateFrom, dateTo } = hFilter;
    if (type  !== 'all' && h.type  !== type)  return false;
    if (level !== 'all' && h.level !== level) return false;
    if (search) {
      const t = search.toLowerCase();
      if (![h.title, h.source, h.detail, h.id].some(s => (s||'').toLowerCase().includes(t))) return false;
    }
    if (dateFrom && h.ts < Helpers.startOfDay(new Date(dateFrom))) return false;
    if (dateTo   && h.ts > Helpers.endOfDay(new Date(dateTo)))     return false;
    return true;
  });
  histPage = 1;
  renderHistTable();
}

function histTypeChange(v)   { hFilter.type    = v; applyHistFilter(); }
function histLevelChange(v)  { hFilter.level   = v; applyHistFilter(); }
function histSearchChange(v) { hFilter.search  = v; applyHistFilter(); }
function histDateFrom(v)     { hFilter.dateFrom = v; applyHistFilter(); }
function histDateTo(v)       { hFilter.dateTo   = v; applyHistFilter(); }

function resetHistFilters() {
  hFilter = { type:'all', level:'all', search:'', dateFrom:'', dateTo:'' };
  ['hf-type','hf-level'].forEach(id => { const el=document.getElementById(id); if(el) el.value='all'; });
  ['hf-search'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  ['hf-from','hf-to'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  applyHistFilter();
}

/* ============================================================ TABLE */
function renderHistTable() {
  const tbody  = document.getElementById('hist-tbody');
  const pagEl  = document.getElementById('hist-pagination');
  if (!tbody) return;

  const { items, total, totalPages } = Helpers.paginate(histFiltered, histPage, PER_PAGE);
  Helpers.setInnerText('hist-count', total);

  if (!items.length) {
    tbody.innerHTML = `<tr class="empty-table-row"><td colspan="6"><i class="fas fa-history" style="font-size:32px;display:block;margin-bottom:10px;color:var(--text-light)"></i>Tidak ada riwayat yang cocok dengan filter.</td></tr>`;
    if (pagEl) pagEl.innerHTML = '';
    return;
  }

  const TYPE_CFG = {
    insiden:    { color:'#E74C3C', icon:'fa-triangle-exclamation', label:'Insiden'    },
    ai:         { color:'#B5651D', icon:'fa-brain',               label:'AI Analisis' },
    peta:       { color:'#27AE60', icon:'fa-map-location-dot',    label:'Peta'        },
    sumberdaya: { color:'#2980B9', icon:'fa-boxes-stacking',      label:'Sumber Daya' },
    sinyal:     { color:'#9B59B6', icon:'fa-satellite-dish',      label:'Sinyal'      },
  };
  const LEV_CFG = {
    BAHAYA:  { color:'#E74C3C', bg:'rgba(231,76,60,.1)'  },
    SIAGA:   { color:'#E67E22', bg:'rgba(230,126,34,.1)' },
    WASPADA: { color:'#F39C12', bg:'rgba(243,156,18,.1)' },
    NORMAL:  { color:'#27AE60', bg:'rgba(46,204,113,.1)' },
    INFO:    { color:'#2980B9', bg:'rgba(41,128,185,.1)' },
  };

  tbody.innerHTML = items.map(h => {
    const tc = TYPE_CFG[h.type] || { color:'#6C757D', icon:'fa-circle', label:h.type };
    const lc = LEV_CFG[h.level] || LEV_CFG.INFO;
    const dt = new Date(h.ts);
    return `<tr>
      <td style="white-space:nowrap">
        <div style="font-size:12px;font-weight:600;color:var(--text)">${dt.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}</div>
        <div style="font-size:10px;color:var(--text-light)">${dt.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</div>
      </td>
      <td><span style="display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:700;background:${tc.color}18;color:${tc.color}"><i class="fas ${tc.icon}"></i>${tc.label}</span></td>
      <td>
        <div style="font-weight:600;font-size:13px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(h.title)}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${escapeHtml(Helpers.truncate(h.detail||'', 70))}</div>
      </td>
      <td><span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:800;background:${lc.bg};color:${lc.color}">${h.level}</span></td>
      <td class="hide-mobile" style="font-size:12px;color:var(--text-muted)">${escapeHtml(h.source)}</td>
      <td style="font-family:var(--font-mono);font-size:10px;color:var(--text-light)">${h.id||'—'}</td>
    </tr>`;
  }).join('');

  renderHistPagination(totalPages);
}

function renderHistPagination(totalPages) {
  const el = document.getElementById('hist-pagination');
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  const range = [];
  for (let i=Math.max(1,histPage-2); i<=Math.min(totalPages,histPage+2); i++) range.push(i);

  let html = `<div class="pagination">
    <button class="page-btn" onclick="goHistPage(${histPage-1})" ${histPage===1?'disabled':''}><i class="fas fa-chevron-left"></i></button>`;
  if (range[0]>1)   { html+=`<button class="page-btn" onclick="goHistPage(1)">1</button>`; if(range[0]>2) html+=`<span class="page-btn" style="cursor:default">…</span>`; }
  range.forEach(p => html+=`<button class="page-btn ${p===histPage?'active':''}" onclick="goHistPage(${p})">${p}</button>`);
  if (range.at(-1)<totalPages) { if(range.at(-1)<totalPages-1) html+=`<span class="page-btn" style="cursor:default">…</span>`; html+=`<button class="page-btn" onclick="goHistPage(${totalPages})">${totalPages}</button>`; }
  html += `<button class="page-btn" onclick="goHistPage(${histPage+1})" ${histPage===totalPages?'disabled':''}><i class="fas fa-chevron-right"></i></button></div>`;
  el.innerHTML = html;
}

function goHistPage(p) {
  const tp = Math.ceil(histFiltered.length / PER_PAGE);
  if (p<1||p>tp) return;
  histPage = p;
  renderHistTable();
}

function exportHistoryCSV() { Exporter.exportHistory(histFiltered); }

Object.assign(window, {
  initHistory, histTypeChange, histLevelChange, histSearchChange,
  histDateFrom, histDateTo, resetHistFilters, exportHistoryCSV, goHistPage,
});
