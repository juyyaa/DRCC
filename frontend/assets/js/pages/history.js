/* ============================================
   DRCC — history.js (Fullstack API version)
   Riwayat agregat dari backend: insiden, AI, peta, sumber daya
   ============================================ */
'use strict';

let histPage   = 1;
const PER_PAGE = 10;
let hFilter = { type:'all', level:'all', search:'', dateFrom:'', dateTo:'' };
let lastItems = [];

/* ============================================================ INIT */
async function initHistory() {
  buildAppShell('history', 'Riwayat Aktivitas', 'Log lengkap semua insiden, analisis AI, marker peta, dan sumber daya');
  await loadStats();
  await applyHistFilter();
}

async function loadStats() {
  try {
    const s = await ApiClient.get('/history/stats');
    const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent = v||0; };
    set('hs-total', s.total); set('hs-insiden', s.insiden); set('hs-ai', s.ai); set('hs-peta', s.peta); set('hs-bahaya', s.bahaya);
  } catch (e) {}
}

/* ============================================================ FILTER */
async function applyHistFilter() {
  histPage = 1;
  await renderHistTable();
}

function histTypeChange(v)   { hFilter.type    = v; applyHistFilter(); }
function histLevelChange(v)  { hFilter.level   = v; applyHistFilter(); }
function histDateFrom(v)     { hFilter.dateFrom = v; applyHistFilter(); }
function histDateTo(v)       { hFilter.dateTo   = v; applyHistFilter(); }

let _debounce;
function histSearchChange(v) {
  hFilter.search = v;
  clearTimeout(_debounce);
  _debounce = setTimeout(applyHistFilter, 350);
}

function resetHistFilters() {
  hFilter = { type:'all', level:'all', search:'', dateFrom:'', dateTo:'' };
  ['hf-type','hf-level'].forEach(id => { const el=document.getElementById(id); if(el) el.value='all'; });
  document.getElementById('hf-search').value = '';
  document.getElementById('hf-from').value = '';
  document.getElementById('hf-to').value = '';
  applyHistFilter();
}

/* ============================================================ TABLE */
async function renderHistTable() {
  const tbody = document.getElementById('hist-tbody');
  if (!tbody) return;

  const params = new URLSearchParams({ page: histPage, perPage: PER_PAGE });
  if (hFilter.type !== 'all')  params.set('type', hFilter.type);
  if (hFilter.level !== 'all') params.set('level', hFilter.level);
  if (hFilter.search)          params.set('search', hFilter.search);
  if (hFilter.dateFrom)        params.set('dateFrom', hFilter.dateFrom);
  if (hFilter.dateTo)          params.set('dateTo', hFilter.dateTo);

  let data;
  try { data = await ApiClient.get('/history?' + params.toString()); }
  catch (e) { Toast.error('Gagal Memuat', e.message); return; }

  lastItems = data.items;
  Helpers_setText('hist-count', data.total);

  if (!data.items.length) {
    tbody.innerHTML = `<tr class="empty-table-row"><td colspan="6"><i class="fas fa-history" style="font-size:32px;display:block;margin-bottom:10px;color:var(--text-light)"></i>Tidak ada riwayat yang cocok dengan filter.</td></tr>`;
    document.getElementById('hist-pagination').innerHTML = '';
    return;
  }

  const TYPE_CFG = {
    insiden:    { color:'#E74C3C', icon:'fa-triangle-exclamation', label:'Insiden'    },
    ai:         { color:'#B5651D', icon:'fa-brain',               label:'AI Analisis' },
    peta:       { color:'#27AE60', icon:'fa-map-location-dot',    label:'Peta'        },
    sumberdaya: { color:'#2980B9', icon:'fa-boxes-stacking',      label:'Sumber Daya' },
  };
  const LEV_CFG = {
    BAHAYA:{color:'#E74C3C',bg:'rgba(231,76,60,.1)'}, SIAGA:{color:'#E67E22',bg:'rgba(230,126,34,.1)'},
    WASPADA:{color:'#F39C12',bg:'rgba(243,156,18,.1)'}, NORMAL:{color:'#27AE60',bg:'rgba(46,204,113,.1)'},
    INFO:{color:'#2980B9',bg:'rgba(41,128,185,.1)'},
  };

  tbody.innerHTML = data.items.map(h => {
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
        <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${escapeHtml((h.detail||'').slice(0,70))}</div>
      </td>
      <td><span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:800;background:${lc.bg};color:${lc.color}">${h.level}</span></td>
      <td class="hide-mobile" style="font-size:12px;color:var(--text-muted)">${escapeHtml(h.source)}</td>
      <td style="font-family:var(--font-mono);font-size:10px;color:var(--text-light)">${h.refId||'—'}</td>
    </tr>`;
  }).join('');

  renderPagination(data.totalPages);
}

function escapeHtml(s) { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
function Helpers_setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

function renderPagination(totalPages) {
  const el = document.getElementById('hist-pagination');
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  const range = [];
  for (let i=Math.max(1,histPage-2); i<=Math.min(totalPages,histPage+2); i++) range.push(i);
  let html = `<div class="pagination"><button class="page-btn" onclick="goHistPage(${histPage-1})" ${histPage===1?'disabled':''}><i class="fas fa-chevron-left"></i></button>`;
  range.forEach(p => html+=`<button class="page-btn ${p===histPage?'active':''}" onclick="goHistPage(${p})">${p}</button>`);
  html += `<button class="page-btn" onclick="goHistPage(${histPage+1})" ${histPage===totalPages?'disabled':''}><i class="fas fa-chevron-right"></i></button></div>`;
  el.innerHTML = html;
}

function goHistPage(p) { if (p<1) return; histPage = p; renderHistTable(); }

/* ============================================================ EXPORT */
function exportHistoryCSV() {
  if (!lastItems.length) { Toast.warning('Kosong', 'Tidak ada data di halaman ini untuk diekspor.'); return; }
  const rows = ['Waktu,Tipe,Level,Judul,Sumber,Detail,RefID'];
  lastItems.forEach(h => rows.push([new Date(h.ts).toLocaleString('id-ID'), h.type, h.level, `"${h.title}"`, `"${h.source}"`, `"${(h.detail||'').replace(/"/g,'""')}"`, h.refId].join(',')));
  const blob = new Blob(['\uFEFF'+rows.join('\n')], { type:'text/csv' });
  const a = Object.assign(document.createElement('a'), { href:URL.createObjectURL(blob), download:`drcc_riwayat_${Date.now()}.csv` });
  a.click();
  Toast.success('Diekspor', `${lastItems.length} baris (halaman ini) diekspor ke CSV`);
}

Object.assign(window, {
  initHistory, histTypeChange, histLevelChange, histSearchChange,
  histDateFrom, histDateTo, resetHistFilters, exportHistoryCSV, goHistPage,
});
