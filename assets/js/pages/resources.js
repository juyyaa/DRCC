/* ============================================
   DRCC — resources.js
   Resource Management CRUD + Assign to Incident
   ============================================ */
'use strict';

const RES_STOR_KEY = 'drcc_resources';
const INC_STOR_KEY = 'drcc_incidents';

let resources  = [];
let editingResId = null;
let resFilter  = 'semua';
let resSearch  = '';

const RES_TYPE_CFG = {
  helikopter: { icon:'fa-helicopter',      label:'Helikopter', color:'#8E4B1E', bg:'rgba(142,75,30,.12)' },
  truk:       { icon:'fa-truck',           label:'Truk',       color:'#27AE60', bg:'rgba(39,174,96,.12)'  },
  perahu:     { icon:'fa-sailboat',        label:'Perahu',     color:'#2980B9', bg:'rgba(41,128,185,.12)' },
  ambulans:   { icon:'fa-truck-medical',   label:'Ambulans',   color:'#E74C3C', bg:'rgba(231,76,60,.12)'  },
  relawan:    { icon:'fa-people-group',    label:'Relawan',    color:'#9B59B6', bg:'rgba(155,89,182,.12)' },
  logistik:   { icon:'fa-boxes-stacking', label:'Logistik',   color:'#B5651D', bg:'rgba(181,101,29,.12)' },
};

const SAMPLE_RESOURCES = [
  { id:'RES-001', name:'Helikopter SAR-01',   type:'helikopter', quantity:1,   status:'deployed',    location:'Bandara Husein Bandung',  assignedTo:'INC-001', notes:'Operasi evakuasi Cianjur',     createdAt:Date.now()-864e5*3, updatedAt:Date.now()-36e5   },
  { id:'RES-002', name:'Helikopter SAR-02',   type:'helikopter', quantity:1,   status:'tersedia',    location:'Pangkalan Udara Halim',   assignedTo:null,      notes:'Siap terbang 1 jam',           createdAt:Date.now()-864e5*3, updatedAt:Date.now()        },
  { id:'RES-003', name:'Truk Logistik-01',    type:'truk',       quantity:5,   status:'tersedia',    location:'Gudang Pusat Jakarta',    assignedTo:null,      notes:'Kapasitas 5 ton/unit',         createdAt:Date.now()-864e5*5, updatedAt:Date.now()        },
  { id:'RES-004', name:'Truk Tangki Air',     type:'truk',       quantity:3,   status:'deployed',    location:'Posko Cianjur',           assignedTo:'INC-001', notes:'Distribusi air bersih',        createdAt:Date.now()-864e5*4, updatedAt:Date.now()-18e5   },
  { id:'RES-005', name:'Perahu Karet SAR-01', type:'perahu',     quantity:8,   status:'deployed',    location:'Kali Ciliwung Jakarta',   assignedTo:'INC-005', notes:'8 unit aktif di Jakarta',      createdAt:Date.now()-864e5*2, updatedAt:Date.now()-9e5    },
  { id:'RES-006', name:'Ambulans Medis-01',   type:'ambulans',   quantity:4,   status:'tersedia',    location:'RSUD Cianjur',            assignedTo:null,      notes:'Lengkap dengan petugas medis', createdAt:Date.now()-864e5*6, updatedAt:Date.now()        },
  { id:'RES-007', name:'Ambulans Medis-02',   type:'ambulans',   quantity:2,   status:'maintenance', location:'Bengkel RS Pusat Jakarta', assignedTo:null,      notes:'Servis rutin mingguan',       createdAt:Date.now()-864e5*7, updatedAt:Date.now()-864e5  },
  { id:'RES-008', name:'Tim Relawan PMI',     type:'relawan',    quantity:120, status:'deployed',    location:'Palu, Sulawesi Tengah',   assignedTo:'INC-002', notes:'120 relawan aktif di lapangan',createdAt:Date.now()-864e5*4, updatedAt:Date.now()-36e5   },
  { id:'RES-009', name:'Tim Relawan BNPB',    type:'relawan',    quantity:85,  status:'tersedia',    location:'Kantor BNPB Jakarta',     assignedTo:null,      notes:'Siap deploy dalam 2 jam',      createdAt:Date.now()-864e5*3, updatedAt:Date.now()        },
  { id:'RES-010', name:'Logistik Pangan-01',  type:'logistik',   quantity:1,   status:'deployed',    location:'Gudang Darurat Cianjur',  assignedTo:'INC-001', notes:'Beras 5 ton + air mineral',    createdAt:Date.now()-864e5*2, updatedAt:Date.now()-18e5   },
  { id:'RES-011', name:'Logistik Pangan-02',  type:'logistik',   quantity:1,   status:'tersedia',    location:'Gudang Regional Jatim',   assignedTo:null,      notes:'Stok 8 ton beras siap kirim',  createdAt:Date.now()-864e5*5, updatedAt:Date.now()        },
];

/* ============================================================ INIT */
function initResources() {
  buildAppShell('resources', 'Sumber Daya', 'Manajemen aset dan penugasan sumber daya');
  loadResources();
  renderTypeSummary();
  renderResTable();
  renderResStats();
  buildIncidentOptions();
}

/* ============================================================ STORAGE */
function loadResources() {
  resources = AppStorage.get(RES_STOR_KEY, null);
  if (!resources) { resources = SAMPLE_RESOURCES.map(r=>({...r})); AppStorage.set(RES_STOR_KEY, resources); }
}
function saveResources() { AppStorage.set(RES_STOR_KEY, resources); }

/* ============================================================ RENDER */
function renderTypeSummary() {
  const container = document.getElementById('type-summary');
  if (!container) return;
  container.innerHTML = Object.entries(RES_TYPE_CFG).map(([type, cfg]) => {
    const items = resources.filter(r => r.type === type);
    const avail = items.filter(r => r.status === 'tersedia').length;
    return `
      <div class="resource-type-card" onclick="resTypeFilter('${type}')" id="rtc-${type}">
        <div class="rt-icon" style="background:${cfg.bg};color:${cfg.color}">
          <i class="fas ${cfg.icon}"></i>
        </div>
        <div class="rt-name">${cfg.label}</div>
        <div class="rt-count">${items.length}</div>
        <div class="rt-avail">${avail} tersedia</div>
      </div>`;
  }).join('');
}

function renderResTable() {
  const tbody = document.getElementById('res-tbody');
  if (!tbody) return;
  const incidents = AppStorage.get(INC_STOR_KEY, []);

  const filtered = resources.filter(r => {
    const matchFilter = resFilter === 'semua' || r.status === resFilter || r.type === resFilter;
    const term = resSearch.toLowerCase();
    const matchSearch = !term || r.name.toLowerCase().includes(term) || r.type.toLowerCase().includes(term) || r.location.toLowerCase().includes(term);
    return matchFilter && matchSearch;
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr class="empty-table-row"><td colspan="7"><i class="fas fa-inbox" style="font-size:32px;display:block;margin-bottom:10px;color:var(--text-light)"></i>Tidak ada sumber daya cocok.</td></tr>`;
    document.getElementById('res-count').textContent = '0';
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const tc = RES_TYPE_CFG[r.type] || RES_TYPE_CFG.logistik;
    const inc = r.assignedTo ? incidents.find(i => i.id === r.assignedTo) : null;
    const assignHtml = inc
      ? `<span class="assign-badge" title="${escapeHtml(inc.title)}"><i class="fas fa-link"></i>${r.assignedTo}</span>`
      : `<span class="unassigned">—</span>`;
    return `<tr>
      <td class="cell-title">
        <div style="font-weight:700">${escapeHtml(r.name)}</div>
        <span style="font-size:10px;color:var(--text-muted)">${escapeHtml(r.notes||'')}</span>
      </td>
      <td><span class="type-chip ${r.type}"><i class="fas ${tc.icon}"></i>${tc.label}</span></td>
      <td style="font-weight:700;text-align:center">${r.quantity.toLocaleString('id-ID')}</td>
      <td><span class="status-badge ${r.status}">${r.status.charAt(0).toUpperCase()+r.status.slice(1)}</span></td>
      <td class="hide-mobile cell-meta">${escapeHtml(r.location)}</td>
      <td class="hide-mobile">${assignHtml}</td>
      <td>
        <div class="action-cell">
          <button class="action-icon-btn assign"  onclick="showAssignModal('${r.id}')" title="Tugaskan ke Insiden"><i class="fas fa-link"></i></button>
          <button class="action-icon-btn edit"    onclick="showEditResModal('${r.id}')" title="Edit"><i class="fas fa-pencil"></i></button>
          <button class="action-icon-btn delete"  onclick="deleteResource('${r.id}')" title="Hapus"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');

  document.getElementById('res-count').textContent = filtered.length;
}

function renderResStats() {
  const total    = resources.length;
  const tersedia = resources.filter(r=>r.status==='tersedia').length;
  const deployed = resources.filter(r=>r.status==='deployed').length;
  const maint    = resources.filter(r=>r.status==='maintenance').length;
  const s = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  s('rst-total',total); s('rst-tersedia',tersedia); s('rst-deployed',deployed); s('rst-maint',maint);
}

/* ============================================================ FILTER */
function resTypeFilter(type) {
  resFilter = type;
  document.querySelectorAll('.resource-type-card').forEach(c => c.classList.toggle('active', c.id===`rtc-${type}`));
  document.querySelectorAll('.res-filter-tab').forEach(t => t.classList.toggle('active', t.dataset.f===type));
  renderResTable();
}

function resFilterChange(tab) {
  resFilter = tab;
  document.querySelectorAll('.res-filter-tab').forEach(t => t.classList.toggle('active', t.dataset.f===tab));
  document.querySelectorAll('.resource-type-card').forEach(c => c.classList.remove('active'));
  renderResTable();
}

function resSearchChange(val) { resSearch = val; renderResTable(); }

/* ============================================================ ADD / EDIT */
function showAddResModal() {
  editingResId = null;
  document.getElementById('res-modal-title').textContent = 'Tambah Sumber Daya';
  document.getElementById('res-form').reset();
  document.getElementById('res-modal')?.classList.remove('hidden');
}

function showEditResModal(id) {
  const r = resources.find(r=>r.id===id);
  if (!r) return;
  editingResId = id;
  document.getElementById('res-modal-title').textContent = 'Edit Sumber Daya';
  const sv = (fid,val) => { const el=document.getElementById(fid); if(el) el.value=val||''; };
  sv('rf-name',r.name); sv('rf-type',r.type); sv('rf-quantity',r.quantity);
  sv('rf-status',r.status); sv('rf-location',r.location); sv('rf-notes',r.notes);
  document.getElementById('res-modal')?.classList.remove('hidden');
}

function hideResModal() { document.getElementById('res-modal')?.classList.add('hidden'); editingResId=null; }

function submitResource() {
  const g = id => document.getElementById(id)?.value.trim();
  const name = g('rf-name');
  if (!name) { Toast.error('Nama Wajib Diisi','Masukkan nama sumber daya'); return; }
  const now = Date.now();
  const data = {
    name, type:g('rf-type')||'logistik',
    quantity:parseInt(g('rf-quantity'))||1,
    status:g('rf-status')||'tersedia',
    location:g('rf-location'),
    notes:g('rf-notes'),
    updatedAt:now,
  };
  if (editingResId) {
    const idx = resources.findIndex(r=>r.id===editingResId);
    if (idx>-1) resources[idx]={...resources[idx],...data};
    Toast.success('Diperbarui',`"${name}" berhasil diperbarui`);
  } else {
    const idNum = String(resources.length+1).padStart(3,'0');
    resources.unshift({ id:`RES-${idNum}`, ...data, assignedTo:null, createdAt:now });
    Toast.success('Ditambahkan',`"${name}" berhasil ditambahkan`);
  }
  saveResources();
  renderTypeSummary();
  renderResTable();
  renderResStats();
  hideResModal();
}

function deleteResource(id) {
  const r = resources.find(r=>r.id===id);
  if (!r) return;
  showConfirm(`Hapus "${r.name}"?`, () => {
    if (r.assignedTo) {
      const incs = AppStorage.get(INC_STOR_KEY,[]).map(i=>({...i,assignedResources:(i.assignedResources||[]).filter(rid=>rid!==id)}));
      AppStorage.set(INC_STOR_KEY,incs);
    }
    resources = resources.filter(r=>r.id!==id);
    saveResources();
    renderTypeSummary();
    renderResTable();
    renderResStats();
    Toast.info('Dihapus',`"${r.name}" dihapus`);
  });
}

/* ============================================================ ASSIGN MODAL */
function buildIncidentOptions() {
  const sel = document.getElementById('assign-inc-select');
  if (!sel) return;
  const incs = AppStorage.get(INC_STOR_KEY,[]).filter(i=>i.status!=='selesai');
  sel.innerHTML = `<option value="">— Pilih Insiden —</option>` +
    incs.map(i=>`<option value="${i.id}">${i.id} · ${escapeHtml(i.title)}</option>`).join('');
}

function showAssignModal(id) {
  const r = resources.find(r=>r.id===id);
  if (!r) return;
  document.getElementById('assign-res-id').value = id;
  document.getElementById('assign-res-name').textContent = r.name;
  const curEl = document.getElementById('assign-current');
  if (curEl) {
    if (r.assignedTo) {
      const inc = AppStorage.get(INC_STOR_KEY,[]).find(i=>i.id===r.assignedTo);
      curEl.innerHTML = `Saat ini ditugaskan ke: <strong>${r.assignedTo}</strong> — ${escapeHtml(inc?.title||'')}`+
        `<button class="btn btn-ghost btn-sm" onclick="unassignResource('${id}')" style="margin-left:8px;color:var(--warning);font-size:11px"><i class="fas fa-unlink"></i> Lepas</button>`;
    } else { curEl.textContent = 'Belum ditugaskan ke insiden manapun.'; }
  }
  buildIncidentOptions();
  document.getElementById('assign-modal')?.classList.remove('hidden');
}

function hideAssignModal() { document.getElementById('assign-modal')?.classList.add('hidden'); }

function confirmAssign() {
  const resId = document.getElementById('assign-res-id')?.value;
  const incId = document.getElementById('assign-inc-select')?.value;
  if (!resId || !incId) { Toast.error('Pilih Insiden','Pilih insiden tujuan penugasan'); return; }

  const idx = resources.findIndex(r=>r.id===resId);
  if (idx<0) return;
  const oldIncId = resources[idx].assignedTo;

  // Unassign from old incident if any
  let incs = AppStorage.get(INC_STOR_KEY,[]);
  if (oldIncId) {
    incs = incs.map(i=>i.id===oldIncId?{...i,assignedResources:(i.assignedResources||[]).filter(r=>r!==resId)}:i);
  }
  // Assign to new incident
  incs = incs.map(i=>i.id===incId?{...i,assignedResources:[...(i.assignedResources||[]).filter(r=>r!==resId),resId]}:i);
  AppStorage.set(INC_STOR_KEY,incs);

  resources[idx] = { ...resources[idx], assignedTo:incId, status:'deployed', updatedAt:Date.now() };
  saveResources();
  renderResTable();
  renderResStats();
  renderTypeSummary();
  hideAssignModal();
  Toast.success('Ditugaskan',`${resources[idx].name} ditugaskan ke ${incId}`);
}

function unassignResource(resId) {
  const idx = resources.findIndex(r=>r.id===resId);
  if (idx<0) return;
  const incId = resources[idx].assignedTo;
  if (incId) {
    const incs = AppStorage.get(INC_STOR_KEY,[]).map(i=>i.id===incId?{...i,assignedResources:(i.assignedResources||[]).filter(r=>r!==resId)}:i);
    AppStorage.set(INC_STOR_KEY,incs);
  }
  resources[idx]={ ...resources[idx], assignedTo:null, status:'tersedia', updatedAt:Date.now() };
  saveResources();
  renderResTable();
  renderResStats();
  renderTypeSummary();
  hideAssignModal();
  Toast.info('Dilepas',`${resources[idx].name} tidak lagi ditugaskan`);
}

Object.assign(window,{
  initResources, resFilterChange, resTypeFilter, resSearchChange,
  showAddResModal, showEditResModal, hideResModal, submitResource, deleteResource,
  showAssignModal, hideAssignModal, confirmAssign, unassignResource,
});
