/* ============================================
   DRCC — incidents.js (Fullstack API + Real-time)
   CRUD insiden via backend, sinkron real-time antar user
   ============================================ */
'use strict';

let allIncidents = [];
let editingId     = null;
let incFilter     = 'semua';
let incSearch      = '';

const PROVINCES = ['Aceh','Sumatera Utara','Sumatera Barat','Riau','Jambi','Sumatera Selatan','Bengkulu','Lampung',
  'DKI Jakarta','Jawa Barat','Jawa Tengah','DI Yogyakarta','Jawa Timur','Banten','Bali',
  'Nusa Tenggara Barat','Nusa Tenggara Timur','Kalimantan Barat','Kalimantan Tengah','Kalimantan Selatan',
  'Kalimantan Timur','Kalimantan Utara','Sulawesi Utara','Sulawesi Tengah','Sulawesi Selatan',
  'Sulawesi Tenggara','Gorontalo','Maluku','Maluku Utara','Papua','Papua Barat'];

const SEV_COLOR = { BAHAYA:'#E74C3C', SIAGA:'#E67E22', WASPADA:'#F39C12', NORMAL:'#27AE60' };
const STAT_COLOR = { aktif:'#E74C3C', ditangani:'#F39C12', selesai:'#27AE60' };

/* ============================================================ INIT */
async function initIncidents() {
  buildAppShell('incidents', 'Manajemen Insiden', 'Daftar, input, dan pengelolaan insiden bencana di seluruh Indonesia');
  populateProvinceOptions();
  await loadIncidents();

  if (window.State) {
    State.on('incident:created', () => loadIncidents());
    State.on('incident:updated', () => loadIncidents());
    State.on('incident:deleted', () => loadIncidents());
  }
}

function populateProvinceOptions() {
  const sel = document.getElementById('f-province');
  if (!sel) return;
  PROVINCES.forEach(p => sel.insertAdjacentHTML('beforeend', `<option value="${p}">${p}</option>`));
}

/* ============================================================ DATA LOADING */
async function loadIncidents() {
  try {
    const [listData, statsData] = await Promise.all([
      ApiClient.get(buildQuery()),
      ApiClient.get('/incidents/stats'),
    ]);
    allIncidents = listData.incidents;
    renderStats(statsData.stats);
    renderTable();
  } catch (e) { Toast.error('Gagal Memuat', e.message); }
}

function buildQuery() {
  const params = new URLSearchParams();
  if (incFilter === 'BAHAYA') params.set('severity', 'BAHAYA');
  else if (incFilter !== 'semua') params.set('status', incFilter);
  if (incSearch) params.set('search', incSearch);
  const qs = params.toString();
  return '/incidents' + (qs ? '?' + qs : '');
}

function renderStats(s) {
  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent = v||0; };
  set('st-total', s.total); set('st-aktif', s.aktif); set('st-ditangani', s.ditangani); set('st-selesai', s.selesai);
}

/* ============================================================ FILTER / SEARCH */
function incFilterChange(f) {
  incFilter = f;
  document.querySelectorAll('.inc-filter-tab').forEach(t => t.classList.toggle('active', t.dataset.f === f));
  loadIncidents();
}
let _searchDebounce;
function incSearchChange(v) {
  incSearch = v;
  clearTimeout(_searchDebounce);
  _searchDebounce = setTimeout(loadIncidents, 350);
}

/* ============================================================ TABLE RENDER */
function renderTable() {
  const tbody = document.getElementById('inc-tbody');
  const countEl = document.getElementById('inc-count');
  if (countEl) countEl.textContent = allIncidents.length;
  if (!tbody) return;

  if (!allIncidents.length) {
    tbody.innerHTML = `<tr class="empty-table-row"><td colspan="8"><i class="fas fa-inbox" style="font-size:32px;display:block;margin-bottom:8px;color:var(--text-light)"></i>Tidak ada insiden ditemukan.</td></tr>`;
    return;
  }

  const canManage = Auth.can('incidents', 'manage');
  tbody.innerHTML = allIncidents.map(i => `
    <tr>
      <td style="font-family:var(--font-mono);font-size:11px">${i.id}</td>
      <td>
        <div style="font-weight:700;font-size:13px">${escapeHtml(i.title)}</div>
        <div style="font-size:11px;color:var(--text-muted)">${escapeHtml(i.location)}, ${escapeHtml(i.province)}</div>
      </td>
      <td class="hide-mobile">${i.type}</td>
      <td><span style="padding:2px 8px;border-radius:20px;font-size:10px;font-weight:800;background:${SEV_COLOR[i.severity]}1a;color:${SEV_COLOR[i.severity]}">${i.severity}</span></td>
      <td><span style="padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:${STAT_COLOR[i.status]}1a;color:${STAT_COLOR[i.status]}">${i.status}</span></td>
      <td class="hide-mobile" style="font-size:12px">${escapeHtml(i.reporter_name||'—')}</td>
      <td class="hide-mobile" style="font-size:11px;color:var(--text-muted)">${new Date(i.updated_at).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn-icon" onclick="viewDetail('${i.id}')" title="Detail" type="button"><i class="fas fa-eye"></i></button>
          ${canManage ? `
          <button class="btn-icon" onclick="editIncident('${i.id}')" title="Edit" type="button"><i class="fas fa-pen"></i></button>
          <button class="btn-icon danger" onclick="deleteIncident('${i.id}')" title="Hapus" type="button"><i class="fas fa-trash"></i></button>` : ''}
        </div>
      </td>
    </tr>`).join('');
}

function escapeHtml(s) { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }

/* ============================================================ ADD / EDIT MODAL */
function showAddModal() {
  if (!Auth.can('incidents','manage')) { Toast.warning('Akses Ditolak','Role Anda hanya bisa melihat insiden.'); return; }
  editingId = null;
  document.getElementById('inc-modal-title').textContent = 'Tambah Insiden';
  document.getElementById('inc-form').reset();
  document.getElementById('inc-modal').classList.remove('hidden');
}

function editIncident(id) {
  const inc = allIncidents.find(i => i.id === id);
  if (!inc) return;
  editingId = id;
  document.getElementById('inc-modal-title').textContent = 'Edit Insiden';
  document.getElementById('f-title').value     = inc.title;
  document.getElementById('f-type').value      = inc.type;
  document.getElementById('f-severity').value  = inc.severity;
  document.getElementById('f-location').value  = inc.location;
  document.getElementById('f-province').value  = inc.province;
  document.getElementById('f-lat').value       = inc.lat;
  document.getElementById('f-lng').value        = inc.lng;
  document.getElementById('f-affected').value   = inc.affected_population;
  document.getElementById('f-desc').value       = inc.description || '';
  document.getElementById('f-reporter').value   = inc.reporter_name || '';
  document.getElementById('f-phone').value      = inc.reporter_phone || '';
  document.getElementById('f-status').value     = inc.status;
  document.getElementById('inc-modal').classList.remove('hidden');
}

function hideIncModal() { document.getElementById('inc-modal').classList.add('hidden'); }

async function submitIncident() {
  const payload = {
    title:    document.getElementById('f-title').value.trim(),
    type:     document.getElementById('f-type').value,
    severity: document.getElementById('f-severity').value,
    location: document.getElementById('f-location').value.trim(),
    province: document.getElementById('f-province').value,
    lat:      parseFloat(document.getElementById('f-lat').value) || 0,
    lng:      parseFloat(document.getElementById('f-lng').value) || 0,
    affectedPopulation: parseInt(document.getElementById('f-affected').value) || 0,
    description: document.getElementById('f-desc').value.trim() || null,
    reporterName: document.getElementById('f-reporter').value.trim() || null,
    reporterPhone: document.getElementById('f-phone').value.trim() || null,
    status: document.getElementById('f-status').value,
  };

  if (!payload.title || !payload.location || !payload.province) {
    Toast.warning('Lengkapi Form', 'Judul, lokasi, dan provinsi wajib diisi.'); return;
  }

  try {
    if (editingId) await ApiClient.put(`/incidents/${editingId}`, payload);
    else            await ApiClient.post('/incidents', payload);
    Toast.success(editingId ? 'Insiden Diperbarui' : 'Insiden Ditambahkan', payload.title);
    hideIncModal();
    await loadIncidents();
  } catch (e) { Toast.error('Gagal Menyimpan', e.message); }
}

/* ============================================================ DETAIL VIEW */
function viewDetail(id) {
  const inc = allIncidents.find(i => i.id === id);
  if (!inc) return;
  document.getElementById('detail-inc-title').textContent = inc.title;
  const resourcesHtml = (inc.assignedResources||[]).length
    ? inc.assignedResources.map(r => `<span style="display:inline-block;padding:3px 10px;background:var(--bg);border-radius:20px;font-size:11px;margin:2px">${r.name} (${r.type})</span>`).join('')
    : '<span style="color:var(--text-muted);font-size:12px">Belum ada sumber daya ditugaskan</span>';

  document.getElementById('detail-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
      <div><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase">ID</div><div style="font-family:var(--font-mono);font-weight:700">${inc.id}</div></div>
      <div><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase">Jenis</div><div style="font-weight:700">${inc.type}</div></div>
      <div><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase">Lokasi</div><div style="font-weight:700">${inc.location}, ${inc.province}</div></div>
      <div><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase">Koordinat</div><div style="font-family:var(--font-mono);font-size:12px">${inc.lat}, ${inc.lng}</div></div>
      <div><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase">Severity</div><div style="font-weight:700;color:${SEV_COLOR[inc.severity]}">${inc.severity}</div></div>
      <div><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase">Status</div><div style="font-weight:700">${inc.status}</div></div>
      <div><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase">Terdampak</div><div style="font-weight:700">${(inc.affected_population||0).toLocaleString('id-ID')} jiwa</div></div>
      <div><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase">Pelapor</div><div style="font-weight:700">${inc.reporter_name||'—'} ${inc.reporter_phone?'· '+inc.reporter_phone:''}</div></div>
    </div>
    <div style="margin-bottom:14px"><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Deskripsi</div><div style="font-size:13px">${inc.description || '—'}</div></div>
    <div><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">Sumber Daya Ditugaskan</div>${resourcesHtml}</div>
  `;
  document.getElementById('detail-modal').classList.remove('hidden');
}

function hideDetailModal() { document.getElementById('detail-modal').classList.add('hidden'); }

/* ============================================================ DELETE */
async function deleteIncident(id) {
  showConfirm(`Hapus insiden ${id}? Sumber daya yang ditugaskan akan otomatis dilepas.`, async () => {
    try {
      await ApiClient.delete(`/incidents/${id}`);
      Toast.success('Dihapus', `Insiden ${id} berhasil dihapus`);
      await loadIncidents();
    } catch (e) { Toast.error('Gagal Menghapus', e.message); }
  });
}

Object.assign(window, {
  initIncidents, incFilterChange, incSearchChange,
  showAddModal, hideIncModal, submitIncident, editIncident,
  viewDetail, hideDetailModal, deleteIncident,
});
