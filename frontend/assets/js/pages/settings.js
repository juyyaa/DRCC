/* ============================================
   DRCC — settings.js (Fullstack API version)
   Profil, password, notifikasi, tampilan — semua via backend
   ============================================ */
'use strict';

const DARK_KEY = 'drcc_dark_mode';
let currentSettings = {};

/* ============================================================ INIT */
async function initSettings() {
  buildAppShell('settings', 'Pengaturan', 'Profil, tampilan, notifikasi, dan keamanan akun');
  await loadSettings();

  // Sembunyikan export evidence jika bukan admin/operator
  if (!Auth.can('demoCenter', 'view')) {
    document.getElementById('btn-export-evidence')?.style && (document.getElementById('btn-export-evidence').style.display = 'none');
  }
}

async function loadSettings() {
  try {
    const data = await ApiClient.get('/settings');
    currentSettings = data;
    populateForm(data);
  } catch (e) { Toast.error('Gagal Memuat', e.message); }
}

function populateForm(data) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  set('s-name',  data.profile?.name);
  set('s-phone', data.profile?.phone);
  set('s-email', data.profile?.email);

  set('s-toast-dur',   data.notif?.toastDuration ?? 4000);
  set('s-alert-level', data.notif?.alertLevel ?? 'WASPADA');
  const snd = document.getElementById('s-sound'); if (snd) snd.checked = !!data.notif?.soundEnabled;

  set('s-font-size', data.display?.fontSize ?? 'medium');
  set('s-language',  data.display?.language ?? 'id');
  set('s-timezone',  data.display?.timezone ?? 'Asia/Jakarta');

  const darkOn = localStorage.getItem(DARK_KEY) === 'true';
  const dm = document.getElementById('s-dark-mode'); if (dm) dm.checked = darkOn;
  updateDarkModeUI(darkOn);
}

/* ============================================================ SAVE PROFILE + PREFERENCES */
async function saveSettings() {
  const gV = id => document.getElementById(id)?.value;
  const gC = id => !!document.getElementById(id)?.checked;

  try {
    await ApiClient.put('/settings/profile', {
      name: gV('s-name'), phone: gV('s-phone'), email: gV('s-email'),
    });
    await ApiClient.put('/settings/preferences', {
      notif:   { toastDuration: parseInt(gV('s-toast-dur'))||4000, soundEnabled: gC('s-sound'), alertLevel: gV('s-alert-level') },
      display: { darkMode: gC('s-dark-mode'), fontSize: gV('s-font-size'), language: gV('s-language'), timezone: gV('s-timezone') },
    });
    applyFontSize(gV('s-font-size'));
    Toast.success('Pengaturan Disimpan', 'Semua perubahan telah disimpan ke server');
    await Auth.refreshMe(); // sync nama terbaru ke navbar
    Navbar.init(Auth.getSession());
  } catch (e) { Toast.error('Gagal Menyimpan', e.message); }
}

/* ============================================================ PASSWORD CHANGE */
async function changePassword() {
  const current = document.getElementById('s-pwd-current').value;
  const next    = document.getElementById('s-pwd-new').value;
  if (!current || !next) { Toast.warning('Lengkapi Form', 'Password lama dan baru wajib diisi.'); return; }
  if (next.length < 6)   { Toast.warning('Password Terlalu Pendek', 'Minimal 6 karakter.'); return; }

  try {
    await ApiClient.put('/settings/password', { currentPassword: current, newPassword: next });
    Toast.success('Password Diubah', 'Gunakan password baru saat login berikutnya');
    document.getElementById('s-pwd-current').value = '';
    document.getElementById('s-pwd-new').value = '';
  } catch (e) { Toast.error('Gagal Mengubah Password', e.message); }
}

/* ============================================================ DARK MODE */
function toggleDarkMode() {
  const current = localStorage.getItem(DARK_KEY) === 'true';
  const next = !current;
  localStorage.setItem(DARK_KEY, next ? 'true' : 'false');
  document.documentElement.classList.toggle('dark-mode', next);
  const cb = document.getElementById('s-dark-mode'); if (cb) cb.checked = next;
  updateDarkModeUI(next);
  Toast.info('Tampilan', next ? '🌙 Dark mode aktif' : '☀️ Light mode aktif');
}

function updateDarkModeUI(enabled) {
  const lbl  = document.getElementById('dark-mode-label');
  const icon = document.getElementById('dark-mode-icon');
  if (lbl)  lbl.textContent = enabled ? 'Dark Mode Aktif' : 'Light Mode';
  if (icon) icon.className  = `fas ${enabled ? 'fa-moon' : 'fa-sun'}`;
}

function applyFontSize(size) {
  const map = { small:'13px', medium:'14px', large:'16px' };
  document.documentElement.style.fontSize = map[size] || '14px';
}

/* ============================================================ EXPORTS */
async function exportIncidentsCSV() {
  try {
    const data = await ApiClient.get('/incidents');
    if (!data.incidents.length) { Toast.warning('Kosong', 'Belum ada insiden.'); return; }
    const rows = ['ID,Judul,Jenis,Lokasi,Provinsi,Severity,Status,Terdampak,Dibuat'];
    data.incidents.forEach(i => rows.push([i.id,`"${i.title}"`,i.type,`"${i.location}"`,i.province,i.severity,i.status,i.affected_population,new Date(i.created_at).toLocaleString('id-ID')].join(',')));
    downloadCSV(rows, `drcc_insiden_${Date.now()}.csv`);
    Toast.success('Diekspor', `${data.incidents.length} insiden diekspor`);
  } catch (e) { Toast.error('Gagal', e.message); }
}

async function exportResourcesCSV() {
  try {
    const data = await ApiClient.get('/resources');
    if (!data.resources.length) { Toast.warning('Kosong', 'Belum ada sumber daya.'); return; }
    const rows = ['ID,Nama,Jenis,Jumlah,Status,Lokasi,Ditugaskan,Diperbarui'];
    data.resources.forEach(r => rows.push([r.id,`"${r.name}"`,r.type,r.quantity,r.status,`"${r.location||''}"`,r.assigned_to||'',new Date(r.updated_at).toLocaleString('id-ID')].join(',')));
    downloadCSV(rows, `drcc_sumberdaya_${Date.now()}.csv`);
    Toast.success('Diekspor', `${data.resources.length} sumber daya diekspor`);
  } catch (e) { Toast.error('Gagal', e.message); }
}

async function exportFullEvidence() {
  try {
    const data = await ApiClient.get('/evidence/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
    const a = Object.assign(document.createElement('a'), { href:URL.createObjectURL(blob), download:`drcc_evidence_${Date.now()}.json` });
    a.click();
    Toast.success('Diekspor', 'Bukti lengkap UAS berhasil diekspor ke JSON');
  } catch (e) { Toast.error('Gagal', e.message); }
}

function downloadCSV(rows, filename) {
  const blob = new Blob(['\uFEFF'+rows.join('\n')], { type:'text/csv' });
  const a = Object.assign(document.createElement('a'), { href:URL.createObjectURL(blob), download:filename });
  a.click();
}

Object.assign(window, {
  initSettings, saveSettings, changePassword, toggleDarkMode,
  exportIncidentsCSV, exportResourcesCSV, exportFullEvidence,
});
