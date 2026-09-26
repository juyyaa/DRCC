/* ============================================
   DRCC — incidents.js
   Incident Form + CRUD + Filter + Modal
   ============================================ */
'use strict';

const INC_KEY = 'drcc_incidents';
const RES_KEY = 'drcc_resources';

let incidents   = [];
let editingId   = null;
let incFilter   = 'semua';
let incSearch   = '';

const PROVINCES = ['Aceh','Sumatera Utara','Sumatera Barat','Riau','Kepulauan Riau','Jambi','Sumatera Selatan','Bangka Belitung','Bengkulu','Lampung','DKI Jakarta','Jawa Barat','Banten','Jawa Tengah','DI Yogyakarta','Jawa Timur','Bali','Nusa Tenggara Barat','Nusa Tenggara Timur','Kalimantan Barat','Kalimantan Tengah','Kalimantan Selatan','Kalimantan Timur','Kalimantan Utara','Sulawesi Utara','Sulawesi Tengah','Sulawesi Selatan','Sulawesi Tenggara','Gorontalo','Sulawesi Barat','Maluku','Maluku Utara','Papua','Papua Barat'];

const TYPE_CFG = {
  gempa:     { icon:'fa-wave-square', label:'Gempa Bumi'  },
  banjir:    { icon:'fa-water',       label:'Banjir'      },
  longsor:   { icon:'fa-mountain',    label:'Longsor'     },
  kebakaran: { icon:'fa-fire',        label:'Kebakaran'   },
  kekeringan:{ icon:'fa-sun',         label:'Kekeringan'  },
  lainnya:   { icon:'fa-circle-dot',  label:'Lainnya'     },
};

const SAMPLE_INCIDENTS = [
  { id:'INC-001', title:'Banjir Bandang Cianjur',  type:'banjir',    location:'Kec. Cugenang',     province:'Jawa Barat',          lat:-6.82, lng:107.14, severity:'BAHAYA',  status:'aktif',     desc:'Banjir bandang melanda 3 desa, ratusan rumah terendam dan warga membutuhkan evakuasi segera.',  reporter:'Ahmad Fauzi',    phone:'081234567890', affected:2480, assignedResources:[], createdAt:Date.now()-864e5*2, updatedAt:Date.now()-36e5   },
  { id:'INC-002', title:'Gempa M5.8 Palu',          type:'gempa',     location:'Palu Tengah',       province:'Sulawesi Tengah',      lat:-0.89, lng:119.87, severity:'BAHAYA',  status:'ditangani', desc:'Gempa M5.8 SR menyebabkan kerusakan struktural pada banyak bangunan bertingkat.',              reporter:'Budi Santoso',   phone:'082345678901', affected:1200, assignedResources:[], createdAt:Date.now()-864e5*3, updatedAt:Date.now()-72e5   },
  { id:'INC-003', title:'Longsor Bogor Selatan',    type:'longsor',   location:'Kec. Ciawi',        province:'Jawa Barat',          lat:-6.60, lng:106.82, severity:'SIAGA',   status:'aktif',     desc:'Tanah longsor menutup jalan nasional, tim SAR sedang beroperasi mencari korban.',               reporter:'Dewi Rahayu',    phone:'083456789012', affected:48,   assignedResources:[], createdAt:Date.now()-864e5,   updatedAt:Date.now()-18e5   },
  { id:'INC-004', title:'Karhutla Riau 2.400 Ha',   type:'kebakaran', location:'Kab. Bengkalis',    province:'Riau',                lat:0.53,  lng:101.45, severity:'BAHAYA',  status:'ditangani', desc:'Kebakaran hutan dan lahan gambut meluas ke pemukiman warga, kabut asap pekat.',                 reporter:'Eko Purnomo',    phone:'084567890123', affected:0,    assignedResources:[], createdAt:Date.now()-864e5*4, updatedAt:Date.now()-36e5*2 },
  { id:'INC-005', title:'Banjir Jakarta Timur',     type:'banjir',    location:'Kec. Cakung',       province:'DKI Jakarta',         lat:-6.22, lng:106.89, severity:'WASPADA', status:'aktif',     desc:'Luapan Kali Ciliwung merendam 3 kelurahan, ketinggian air mencapai 1.5 meter.',               reporter:'Fitri Handayani',phone:'085678901234', affected:8900, assignedResources:[], createdAt:Date.now()-432e5,   updatedAt:Date.now()-9e5    },
  { id:'INC-006', title:'Angin Kencang Makassar',   type:'lainnya',   location:'Makassar Barat',    province:'Sulawesi Selatan',    lat:-5.15, lng:119.43, severity:'WASPADA', status:'selesai',   desc:'Angin kencang 85 km/jam merobohkan pohon dan merusak atap rumah warga.',                      reporter:'Gunawan S.',     phone:'086789012345', affected:124,  assignedResources:[], createdAt:Date.now()-864e5*5, updatedAt:Date.now()-864e5  },
  { id:'INC-007', title:'Kekeringan NTT',           type:'kekeringan',location:'Kab. Timor Tengah', province:'Nusa Tenggara Timur', lat:-9.80, lng:124.30, severity:'NORMAL',  status:'ditangani', desc:'Kekeringan berkepanjangan mengancam ketahanan pangan masyarakat pedesaan.',                    reporter:'Hendra Wijaya',  phone:'087890123456', affected:3200, assignedResources:[], createdAt:Date.now()-864e5*6, updatedAt:Date.now()-864e5*2},
  { id:'INC-008', title:'Banjir Semarang Utara',    type:'banjir',    location:'Kec. Semarang Utara',province:'Jawa Tengah',       lat:-6.97, lng:110.42, severity:'WASPADA', status:'selesai',   desc:'Banjir rob dan hujan deras. Situasi sudah kembali normal setelah pompa diperbaiki.',          reporter:'Indah Permata',  phone:'088901234567', affected:820,  assignedResources:[], createdAt:Date.now()-864e5*7, updatedAt:Date.now()-864e5*3},
];

/* ============================================================ INIT */
function initIncidents() {
  buildAppShell('incidents', 'Manajemen Insiden', 'Daftar dan pengelolaan insiden bencana');
  loadIncidents();
  buildProvinceOptions('f-province');
  renderTable();
  renderStats();
}

function buildProvinceOptions(id) {
  const sel = document.getElementById(id);
  if (!sel) return;
  PROVINCES.forEach(p => sel.insertAdjacentHTML('beforeend', `<option value="${p}">${p}</option>`));
}

/* ============================================================ STORAGE */
function loadIncidents() {
  incidents = AppStorage.get(INC_KEY, null);
  if (!incidents) { incidents = SAMPLE_INCIDENTS.map(i=>({...i})); AppStorage.set(INC_KEY, incidents); }
}
function saveIncidents() { AppStorage.set(INC_KEY, incidents); }

/* ============================================================ RENDER TABLE */
function renderTable() {
  const tbody = document.getElementById('inc-tbody');
  if (!tbody) return;

  const filtered = incidents.filter(inc => {
    const matchFilter = incFilter === 'semua' || inc.status === incFilter || inc.severity === incFilter;
    const term = incSearch.toLowerCase();
    const matchSearch = !term || inc.title.toLowerCase().includes(term) || inc.location.toLowerCase().includes(term) || inc.province.toLowerCase().includes(term) || inc.reporter?.toLowerCase().includes(term);
    return matchFilter && matchSearch;
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr class="empty-table-row"><td colspan="8"><i class="fas fa-inbox" style="font-size:32px;display:block;margin-bottom:10px;color:var(--text-light)"></i>Tidak ada insiden yang cocok dengan filter.</td></tr>`;
    document.getElementById('inc-count').textContent = '0';
    return;
  }

  tbody.innerHTML = filtered.map(inc => {
    const tc  = TYPE_CFG[inc.type] || TYPE_CFG.lainnya;
    const ts  = formatTimeAgo(inc.updatedAt);
    const res = AppStorage.get(RES_KEY, []).filter(r => inc.assignedResources?.includes(r.id));
    return `<tr>
      <td class="cell-id">${inc.id}</td>
      <td class="cell-title" style="max-width:180px">
        <div style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(inc.title)}</div>
        <span style="font-size:10px;color:var(--text-muted)">${escapeHtml(inc.location)}, ${inc.province}</span>
      </td>
      <td class="hide-mobile"><span class="type-chip ${inc.type}"><i class="fas ${tc.icon}"></i>${tc.label}</span></td>
      <td><span class="sev-badge ${inc.severity}">${inc.severity}</span></td>
      <td><span class="status-badge ${inc.status}">${inc.status.charAt(0).toUpperCase()+inc.status.slice(1)}</span></td>
      <td class="hide-mobile cell-meta">${escapeHtml(inc.reporter||'—')}</td>
      <td class="hide-mobile cell-meta" style="font-size:11px;color:var(--text-light)">${ts}</td>
      <td>
        <div class="action-cell">
          <button class="action-icon-btn view"   onclick="showDetailModal('${inc.id}')" title="Detail"><i class="fas fa-eye"></i></button>
          <button class="action-icon-btn edit"   onclick="showEditModal('${inc.id}')"   title="Edit"><i class="fas fa-pencil"></i></button>
          <button class="action-icon-btn delete" onclick="deleteIncident('${inc.id}')" title="Hapus"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');

  document.getElementById('inc-count').textContent = filtered.length;
}

function renderStats() {
  const total    = incidents.length;
  const aktif    = incidents.filter(i=>i.status==='aktif').length;
  const ditangani= incidents.filter(i=>i.status==='ditangani').length;
  const selesai  = incidents.filter(i=>i.status==='selesai').length;
  const s = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  s('st-total',total); s('st-aktif',aktif); s('st-ditangani',ditangani); s('st-selesai',selesai);
}

/* ============================================================ FILTER / SEARCH */
function incFilterChange(tab) {
  incFilter = tab;
  document.querySelectorAll('.inc-filter-tab').forEach(t => t.classList.toggle('active', t.dataset.f === tab));
  renderTable();
}

function incSearchChange(val) {
  incSearch = val;
  renderTable();
}

/* ============================================================ ADD / EDIT MODAL */
function showAddModal() {
  editingId = null;
  document.getElementById('inc-modal-title').textContent = 'Tambah Insiden Baru';
  document.getElementById('inc-form').reset();
  document.getElementById('f-status').value = 'aktif';
  document.getElementById('inc-modal')?.classList.remove('hidden');
}

function showEditModal(id) {
  const inc = incidents.find(i => i.id === id);
  if (!inc) return;
  editingId = id;
  document.getElementById('inc-modal-title').textContent = 'Edit Insiden';
  const setV = (fid, val) => { const el=document.getElementById(fid); if(el) el.value=val||''; };
  setV('f-title',inc.title); setV('f-type',inc.type); setV('f-location',inc.location);
  setV('f-province',inc.province); setV('f-lat',inc.lat); setV('f-lng',inc.lng);
  setV('f-severity',inc.severity); setV('f-status',inc.status); setV('f-desc',inc.desc);
  setV('f-reporter',inc.reporter); setV('f-phone',inc.phone); setV('f-affected',inc.affected);
  document.getElementById('inc-modal')?.classList.remove('hidden');
}

function hideIncModal() {
  document.getElementById('inc-modal')?.classList.add('hidden');
  editingId = null;
}

function submitIncident() {
  const g = id => document.getElementById(id)?.value.trim();
  const title = g('f-title');
  if (!title) { Toast.error('Judul Wajib Diisi','Masukkan judul insiden'); return; }

  const now = Date.now();
  const data = {
    title, type:g('f-type')||'lainnya', location:g('f-location'), province:g('f-province'),
    lat:parseFloat(g('f-lat'))||0, lng:parseFloat(g('f-lng'))||0,
    severity:g('f-severity')||'NORMAL', status:g('f-status')||'aktif',
    desc:g('f-desc'), reporter:g('f-reporter'), phone:g('f-phone'),
    affected:parseInt(g('f-affected'))||0, updatedAt:now,
  };

  if (editingId) {
    const idx = incidents.findIndex(i=>i.id===editingId);
    if (idx > -1) incidents[idx] = { ...incidents[idx], ...data };
    Toast.success('Insiden Diperbarui', `"${title}" berhasil diperbarui`);
  } else {
    const idNum = String(incidents.length+1).padStart(3,'0');
    incidents.unshift({ id:`INC-${idNum}`, ...data, assignedResources:[], createdAt:now });
    Toast.success('Insiden Ditambahkan', `"${title}" berhasil ditambahkan`);
  }

  saveIncidents();
  renderTable();
  renderStats();
  hideIncModal();
}

function deleteIncident(id) {
  const inc = incidents.find(i=>i.id===id);
  if (!inc) return;
  showConfirm(`Hapus insiden "${inc.title}"? Tindakan ini tidak dapat dibatalkan.`, () => {
    incidents = incidents.filter(i=>i.id!==id);
    // Unassign resources
    const resources = AppStorage.get(RES_KEY,[]).map(r => r.assignedTo===id ? {...r, assignedTo:null, status:'tersedia'} : r);
    AppStorage.set(RES_KEY, resources);
    saveIncidents();
    renderTable();
    renderStats();
    Toast.info('Insiden Dihapus', `"${inc.title}" dihapus`);
  });
}

/* ============================================================ DETAIL MODAL */
function showDetailModal(id) {
  const inc = incidents.find(i=>i.id===id);
  if (!inc) return;
  const tc = TYPE_CFG[inc.type] || TYPE_CFG.lainnya;
  const resources = AppStorage.get(RES_KEY,[]).filter(r => inc.assignedResources?.includes(r.id));
  const resHtml = resources.length
    ? resources.map(r=>`<span class="assign-badge"><i class="fas fa-check-circle"></i>${escapeHtml(r.name)}</span>`).join(' ')
    : '<span class="unassigned">Belum ada sumber daya</span>';

  const body = document.getElementById('detail-body');
  if (!body) return;
  body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 20px;margin-bottom:16px">
      ${[
        ['ID Insiden',  inc.id,         'fa-hashtag'],
        ['Jenis',       `<span class="type-chip ${inc.type}"><i class="fas ${tc.icon}"></i>${tc.label}</span>`, 'fa-tag'],
        ['Lokasi',      `${escapeHtml(inc.location)}, ${escapeHtml(inc.province)}`, 'fa-location-dot'],
        ['Severity',    `<span class="sev-badge ${inc.severity}">${inc.severity}</span>`, 'fa-circle-exclamation'],
        ['Status',      `<span class="status-badge ${inc.status}">${inc.status}</span>`, 'fa-circle'],
        ['Terdampak',   formatNumber(inc.affected)+' jiwa', 'fa-people-group'],
        ['Koordinat',   `${inc.lat||'—'}, ${inc.lng||'—'}`, 'fa-map-pin'],
        ['Pelapor',     `${escapeHtml(inc.reporter||'—')} · ${inc.phone||'—'}`, 'fa-user'],
      ].map(([lbl,val,ico])=>`
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px"><i class="fas ${ico}" style="color:var(--copper);margin-right:4px"></i>${lbl}</div>
          <div style="font-size:13px;color:var(--text)">${val}</div>
        </div>`).join('')}
    </div>
    <div style="margin-bottom:14px">
      <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:5px"><i class="fas fa-align-left" style="color:var(--copper);margin-right:4px"></i>Deskripsi</div>
      <p style="font-size:13px;color:var(--text);line-height:1.6">${escapeHtml(inc.desc||'Tidak ada deskripsi.')}</p>
    </div>
    <div>
      <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px"><i class="fas fa-boxes-stacking" style="color:var(--copper);margin-right:4px"></i>Sumber Daya Ditugaskan</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${resHtml}</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
      <button class="btn btn-primary btn-sm" onclick="hideDetailModal();showEditModal('${id}')"><i class="fas fa-pencil"></i> Edit</button>
      <button class="btn btn-danger btn-sm"  onclick="hideDetailModal();deleteIncident('${id}')"><i class="fas fa-trash"></i> Hapus</button>
      <span style="font-size:11px;color:var(--text-muted);margin-left:auto;align-self:center">Dibuat: ${formatDate(inc.createdAt)}</span>
    </div>`;

  document.getElementById('detail-inc-title').textContent = inc.title;
  document.getElementById('detail-modal')?.classList.remove('hidden');
}

function hideDetailModal() { document.getElementById('detail-modal')?.classList.add('hidden'); }

Object.assign(window, {
  initIncidents, incFilterChange, incSearchChange,
  showAddModal, showEditModal, hideIncModal, submitIncident, deleteIncident,
  showDetailModal, hideDetailModal,
});
