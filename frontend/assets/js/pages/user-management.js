/* ============================================
   DRCC — user-management.js
   CRUD user 4 role (admin/operator/relawan/pemda) — Admin only
   ============================================ */
'use strict';

let allUsers = [];
let userFilter = 'semua';
let userSearch  = '';
let editingUserId = null;

const PROVINCES = ['Aceh','Sumatera Utara','Sumatera Barat','Riau','Jambi','Sumatera Selatan','Bengkulu','Lampung',
  'DKI Jakarta','Jawa Barat','Jawa Tengah','DI Yogyakarta','Jawa Timur','Banten','Bali',
  'Nusa Tenggara Barat','Nusa Tenggara Timur','Kalimantan Barat','Kalimantan Tengah','Kalimantan Selatan',
  'Kalimantan Timur','Kalimantan Utara','Sulawesi Utara','Sulawesi Tengah','Sulawesi Selatan',
  'Sulawesi Tenggara','Gorontalo','Maluku','Maluku Utara','Papua','Papua Barat'];

const ROLE_LABEL = { admin:'Admin BNPB', operator:'Operator', relawan:'Relawan', pemda:'Pemda' };
const ROLE_COLOR = { admin:'#B5651D', operator:'#2980B9', relawan:'#27AE60', pemda:'#8E44AD' };

/* ============================================================ INIT */
async function initUserManagement() {
  buildAppShell('user-management', 'Kelola User', 'Manajemen akun untuk 4 role sistem');

  if (!Auth.can('userManagement', 'view')) {
    document.getElementById('page-content').innerHTML = `<div style="text-align:center;padding:60px"><i class="fas fa-lock" style="font-size:40px;color:var(--text-light)"></i><h3 style="margin-top:12px;color:var(--text-muted)">Halaman ini khusus Administrator</h3></div>`;
    return;
  }

  populateProvinceOptions();
  await loadUsers();

  if (window.State) {
    State.on('user:created', loadUsers);
    State.on('user:updated', loadUsers);
    State.on('user:deleted', loadUsers);
  }
}

function populateProvinceOptions() {
  const sel = document.getElementById('uf-province');
  if (!sel) return;
  PROVINCES.forEach(p => sel.insertAdjacentHTML('beforeend', `<option value="${p}">${p}</option>`));
}

/* ============================================================ DATA LOADING */
async function loadUsers() {
  try {
    const params = new URLSearchParams();
    if (userFilter !== 'semua') params.set('role', userFilter);
    if (userSearch) params.set('search', userSearch);
    const data = await ApiClient.get('/users?' + params.toString());
    allUsers = data.users;
    renderStats();
    renderTable();
  } catch (e) { Toast.error('Gagal Memuat', e.message); }
}

function renderStats() {
  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  set('us-total', allUsers.length);
  set('us-admin', allUsers.filter(u=>u.role==='admin').length);
  set('us-operator', allUsers.filter(u=>u.role==='operator').length);
  set('us-relawan', allUsers.filter(u=>u.role==='relawan').length);
  set('us-pemda', allUsers.filter(u=>u.role==='pemda').length);
}

function userFilterChange(f) {
  userFilter = f;
  document.querySelectorAll('.user-filter-tab').forEach(t => t.classList.toggle('active', t.dataset.f === f));
  loadUsers();
}
let _debounce;
function userSearchChange(v) { userSearch = v; clearTimeout(_debounce); _debounce = setTimeout(loadUsers, 350); }

/* ============================================================ TABLE */
function renderTable() {
  const tbody = document.getElementById('user-tbody');
  if (!tbody) return;
  if (!allUsers.length) { tbody.innerHTML = `<tr class="empty-table-row"><td colspan="8">Tidak ada user.</td></tr>`; return; }

  const me = Auth.getSession();
  tbody.innerHTML = allUsers.map(u => {
    const col = ROLE_COLOR[u.role];
    const isSelf = u.id === me.id;
    return `<tr>
      <td style="font-family:var(--font-mono);font-size:12px">${escapeHtml(u.username)}</td>
      <td style="font-weight:700">${escapeHtml(u.name)}</td>
      <td><span style="padding:2px 8px;border-radius:20px;font-size:10px;font-weight:800;background:${col}1a;color:${col}">${ROLE_LABEL[u.role]}</span></td>
      <td class="hide-mobile" style="font-size:12px">${u.province||'—'}</td>
      <td class="hide-mobile" style="font-size:12px">${u.email||'—'}</td>
      <td><span style="padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:${u.status==='active'?'rgba(39,174,96,.1)':'rgba(231,76,60,.1)'};color:${u.status==='active'?'#27AE60':'#E74C3C'}">${u.status==='active'?'Aktif':'Nonaktif'}</span></td>
      <td class="hide-mobile" style="font-size:11px;color:var(--text-muted)">${u.last_login_at ? new Date(u.last_login_at).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : 'Belum pernah'}</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn-icon" onclick="editUser(${u.id})" title="Edit" type="button"><i class="fas fa-pen"></i></button>
          ${!isSelf ? `<button class="btn-icon danger" onclick="deleteUser(${u.id})" title="Hapus" type="button"><i class="fas fa-trash"></i></button>` : '<span style="font-size:10px;color:var(--text-muted)">(Anda)</span>'}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function escapeHtml(s) { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }

/* ============================================================ ADD / EDIT MODAL */
function showAddUserModal() {
  editingUserId = null;
  document.getElementById('user-modal-title').textContent = 'Tambah User';
  document.getElementById('user-form').reset();
  document.getElementById('uf-password-field').style.display = '';
  document.getElementById('uf-password').required = true;
  document.getElementById('user-modal').classList.remove('hidden');
}

function editUser(id) {
  const u = allUsers.find(x => x.id === id);
  if (!u) return;
  editingUserId = id;
  document.getElementById('user-modal-title').textContent = 'Edit User';
  document.getElementById('uf-username').value = u.username;
  document.getElementById('uf-username').disabled = true;
  document.getElementById('uf-password-field').style.display = 'none';
  document.getElementById('uf-password').required = false;
  document.getElementById('uf-name').value     = u.name;
  document.getElementById('uf-role').value     = u.role;
  document.getElementById('uf-status').value   = u.status;
  document.getElementById('uf-province').value = u.province || '';
  document.getElementById('uf-email').value    = u.email || '';
  document.getElementById('uf-phone').value     = u.phone || '';
  document.getElementById('user-modal').classList.remove('hidden');
}

function hideUserModal() {
  document.getElementById('user-modal').classList.add('hidden');
  document.getElementById('uf-username').disabled = false;
}

async function submitUser() {
  const payload = {
    name:     document.getElementById('uf-name').value.trim(),
    role:     document.getElementById('uf-role').value,
    status:   document.getElementById('uf-status').value,
    province: document.getElementById('uf-province').value || null,
    email:    document.getElementById('uf-email').value.trim() || null,
    phone:    document.getElementById('uf-phone').value.trim() || null,
  };

  try {
    if (editingUserId) {
      await ApiClient.put(`/users/${editingUserId}`, payload);
      Toast.success('Diperbarui', payload.name);
    } else {
      payload.username = document.getElementById('uf-username').value.trim();
      payload.password = document.getElementById('uf-password').value;
      if (!payload.username || !payload.password) { Toast.warning('Lengkapi Form', 'Username dan password wajib diisi.'); return; }
      if (payload.password.length < 6) { Toast.warning('Password Terlalu Pendek', 'Minimal 6 karakter.'); return; }
      await ApiClient.post('/users', payload);
      Toast.success('Ditambahkan', payload.name);
    }
    hideUserModal();
    await loadUsers();
  } catch (e) { Toast.error('Gagal Menyimpan', e.message); }
}

/* ============================================================ DELETE */
async function deleteUser(id) {
  showConfirm('Hapus user ini? Tindakan tidak bisa dibatalkan.', async () => {
    try {
      await ApiClient.delete(`/users/${id}`);
      Toast.success('Dihapus', 'User berhasil dihapus');
      await loadUsers();
    } catch (e) { Toast.error('Gagal Menghapus', e.message); }
  });
}

Object.assign(window, {
  initUserManagement, userFilterChange, userSearchChange,
  showAddUserModal, hideUserModal, submitUser, editUser, deleteUser,
});
