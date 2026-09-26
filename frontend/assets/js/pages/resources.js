/* ============================================
   DRCC — resources.js (Fullstack API + Real-time)
   CRUD sumber daya + assign/unassign ke insiden, sinkron real-time
   ============================================ */
'use strict';

let allResources = [];
let allIncidentsForAssign = [];
let editingResId = null;
let resFilter    = 'semua';

const STAT_COLOR = { tersedia:'#27AE60', deployed:'#2980B9', maintenance:'#F39C12' };
const TYPE_ICON  = { Helikopter:'fa-helicopter', Truk:'fa-truck', Perahu:'fa-ship', Ambulans:'fa-truck-medical', Relawan:'fa-people-group', Logistik:'fa-boxes-stacking' };

/* ============================================================ INIT */
async function initResources() {
  buildAppShell('resources', 'Manajemen Sumber Daya', 'Aset, kendaraan, dan personel respons bencana');
  await loadResources();

  if (window.State) {
    State.on('resource:created', loadResources);
    State.on('resource:updated', loadResources);
    State.on('resource:deleted', loadResources);
  }
}

/* ============================================================ DATA LOADING */
async function loadResources() {
  try {
    const [listData, statsData] = await Promise.all([
      ApiClient.get(buildQuery()),
      ApiClient.get('/resources/stats'),
    ]);
    allResources = listData.resources;
    renderTypeSummary(statsData.byType, statsData.stats);
    renderStats(statsData.stats);
    renderTable();
  } catch (e) { Toast.error('Gagal Memuat', e.message); }
}

function buildQuery() {
  const params = new URLSearchParams();
  if (resFilter !== 'semua') params.set('status', resFilter);
  const qs = params.toString();
  return '/resources' + (qs ? '?' + qs : '');
}

function renderStats(s) {
  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent = v||0; };
  set('rst-total', s.total); set('rst-tersedia', s.tersedia); set('rst-deployed', s.deployed); set('rst-maint', s.maintenance);
}

function renderTypeSummary(byType, stats) {
  const grid = document.getElementById('type-summary');
  if (!grid) return;
  grid.innerHTML = (byType||[]).map(t => `
    <div class="resource-type-card">
      <div class="rt-icon"><i class="fas ${TYPE_ICON[t.type]||'fa-box'}"></i></div>
      <div class="rt-count">${t.count}</div>
      <div class="rt-label">${t.type}</div>
    </div>`).join('');
}

/* ============================================================ FILTER */
function resFilterChange(f) {
  resFilter = f;
  document.querySelectorAll('.res-filter-tab').forEach(t => t.classList.toggle('active', t.dataset.f === f));
  loadResources();
}

/* ============================================================ TABLE */
function renderTable() {
  const tbody = document.getElementById('res-tbody');
  const countEl = document.getElementById('res-count');
  if (countEl) countEl.textContent = allResources.length;
  if (!tbody) return;

  if (!allResources.length) {
    tbody.innerHTML = `<tr class="empty-table-row"><td colspan="7"><i class="fas fa-box-open" style="font-size:32px;display:block;margin-bottom:8px;color:var(--text-light)"></i>Belum ada sumber daya.</td></tr>`;
    return;
  }

  const canManage = Auth.can('resources','manage');
  tbody.innerHTML = allResources.map(r => `
    <tr>
      <td style="font-family:var(--font-mono);font-size:11px">${r.id}</td>
      <td><i class="fas ${TYPE_ICON[r.type]||'fa-box'}" style="color:var(--copper);margin-right:6px"></i>${escapeHtml(r.name)}</td>
      <td>${r.type}</td>
      <td>${r.quantity}</td>
      <td><span style="padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:${STAT_COLOR[r.status]}1a;color:${STAT_COLOR[r.status]}">${r.status}</span></td>
      <td style="font-size:12px">${r.assigned_to ? `<a href="incidents.html" style="color:var(--copper)">${r.assigned_to}</a>` : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>
        <div style="display:flex;gap:4px">
          ${canManage ? `
          <button class="btn-icon" onclick="openAssignModal('${r.id}')" title="Assign" type="button"><i class="fas fa-link"></i></button>
          <button class="btn-icon" onclick="editResource('${r.id}')" title="Edit" type="button"><i class="fas fa-pen"></i></button>
          <button class="btn-icon danger" onclick="deleteResource('${r.id}')" title="Hapus" type="button"><i class="fas fa-trash"></i></button>` : '<span style="color:var(--text-muted);font-size:11px">View only</span>'}
        </div>
      </td>
    </tr>`).join('');
}

function escapeHtml(s) { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }

/* ============================================================ ADD / EDIT MODAL */
function showAddResModal() {
  if (!Auth.can('resources','manage')) { Toast.warning('Akses Ditolak','Role Anda hanya bisa melihat sumber daya.'); return; }
  editingResId = null;
  document.getElementById('res-modal-title').textContent = 'Tambah Sumber Daya';
  document.getElementById('res-form').reset();
  document.getElementById('res-modal').classList.remove('hidden');
}

function editResource(id) {
  const r = allResources.find(x => x.id === id);
  if (!r) return;
  editingResId = id;
  document.getElementById('res-modal-title').textContent = 'Edit Sumber Daya';
  document.getElementById('rf-name').value     = r.name;
  document.getElementById('rf-type').value     = r.type;
  document.getElementById('rf-quantity').value = r.quantity;
  document.getElementById('rf-status').value   = r.status;
  document.getElementById('rf-location').value = r.location || '';
  document.getElementById('rf-notes').value    = r.notes || '';
  document.getElementById('res-modal').classList.remove('hidden');
}

function hideResModal() { document.getElementById('res-modal').classList.add('hidden'); }

async function submitResource() {
  const payload = {
    name:     document.getElementById('rf-name').value.trim(),
    type:     document.getElementById('rf-type').value,
    quantity: parseInt(document.getElementById('rf-quantity').value) || 1,
    status:   document.getElementById('rf-status').value,
    location: document.getElementById('rf-location').value.trim() || null,
    notes:    document.getElementById('rf-notes').value.trim() || null,
  };
  if (!payload.name) { Toast.warning('Lengkapi Form', 'Nama wajib diisi.'); return; }

  try {
    if (editingResId) await ApiClient.put(`/resources/${editingResId}`, payload);
    else               await ApiClient.post('/resources', payload);
    Toast.success(editingResId ? 'Diperbarui' : 'Ditambahkan', payload.name);
    hideResModal();
    await loadResources();
  } catch (e) { Toast.error('Gagal Menyimpan', e.message); }
}

/* ============================================================ ASSIGN / UNASSIGN */
async function openAssignModal(resId) {
  const r = allResources.find(x => x.id === resId);
  if (!r) return;
  document.getElementById('assign-res-id').value = resId;
  document.getElementById('assign-res-name').textContent = r.name;
  document.getElementById('assign-current').textContent = r.assigned_to
    ? `Saat ini ditugaskan ke insiden: ${r.assigned_to}` : 'Belum ditugaskan ke insiden manapun.';

  try {
    const data = await ApiClient.get('/incidents?status=aktif');
    allIncidentsForAssign = data.incidents;
    const sel = document.getElementById('assign-inc-select');
    sel.innerHTML = '<option value="">— Pilih Insiden —</option>' +
      allIncidentsForAssign.map(i => `<option value="${i.id}">${i.id} — ${i.title}</option>`).join('');
  } catch (e) { Toast.error('Gagal Memuat Insiden', e.message); }

  document.getElementById('assign-modal').classList.remove('hidden');
}

function hideAssignModal() { document.getElementById('assign-modal').classList.add('hidden'); }

async function confirmAssign() {
  const resId = document.getElementById('assign-res-id').value;
  const incId = document.getElementById('assign-inc-select').value;
  if (!incId) { Toast.warning('Pilih Insiden', 'Pilih insiden tujuan penugasan.'); return; }

  try {
    await ApiClient.post(`/resources/${resId}/assign`, { incidentId: incId });
    Toast.success('Ditugaskan', `Sumber daya berhasil ditugaskan ke ${incId}`);
    hideAssignModal();
    await loadResources();
  } catch (e) { Toast.error('Gagal Menugaskan', e.message); }
}

async function unassignResource(resId) {
  try {
    await ApiClient.post(`/resources/${resId}/unassign`, {});
    Toast.success('Dilepas', 'Penugasan sumber daya dibatalkan');
    await loadResources();
  } catch (e) { Toast.error('Gagal', e.message); }
}

/* ============================================================ DELETE */
async function deleteResource(id) {
  showConfirm(`Hapus sumber daya ${id}?`, async () => {
    try {
      await ApiClient.delete(`/resources/${id}`);
      Toast.success('Dihapus', `${id} berhasil dihapus`);
      await loadResources();
    } catch (e) { Toast.error('Gagal Menghapus', e.message); }
  });
}

Object.assign(window, {
  initResources, resFilterChange, showAddResModal, hideResModal, submitResource,
  editResource, openAssignModal, hideAssignModal, confirmAssign, unassignResource, deleteResource,
});
