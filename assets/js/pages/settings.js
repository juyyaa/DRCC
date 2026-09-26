/* ============================================
   DRCC — settings.js
   Profil, notifikasi, tampilan, dark mode, data management
   ============================================ */
'use strict';

const SETTINGS_KEY = 'drcc_settings';
const DARK_KEY     = 'drcc_dark_mode';

const DEFAULTS = {
  profile:  { displayName:'', phone:'', email:'' },
  notif:    { toastDuration:4000, soundEnabled:false, alertLevel:'WASPADA' },
  display:  { darkMode:false, fontSize:'medium', language:'id', timezone:'Asia/Jakarta' },
};

let cfg = {};

/* ============================================================ INIT */
function initSettings() {
  buildAppShell('settings', 'Pengaturan', 'Profil, tampilan, notifikasi, dan manajemen data');
  loadConfig();
  populateForm();
  renderStorageInfo();
}

/* ============================================================ LOAD / SAVE */
function loadConfig() {
  const saved = AppStorage.get(SETTINGS_KEY, null);
  cfg = {
    profile: { ...DEFAULTS.profile, ...(saved?.profile || {}) },
    notif:   { ...DEFAULTS.notif,   ...(saved?.notif   || {}) },
    display: { ...DEFAULTS.display, ...(saved?.display || {}) },
  };
  // Pre-fill from current session if profile empty
  const session = Auth.getSession();
  if (session && !cfg.profile.displayName) {
    cfg.profile.displayName = session.name || '';
  }
}

function saveSettings() {
  const gV = id => Helpers.getInputValue(id);
  const gC = id => !!document.getElementById(id)?.checked;
  const gI = (id, fallback) => parseInt(gV(id)) || fallback;

  cfg.profile.displayName = gV('s-name');
  cfg.profile.phone       = gV('s-phone');
  cfg.profile.email       = gV('s-email');

  cfg.notif.toastDuration = gI('s-toast-dur', 4000);
  cfg.notif.soundEnabled  = gC('s-sound');
  cfg.notif.alertLevel    = gV('s-alert-level') || 'WASPADA';

  cfg.display.darkMode    = gC('s-dark-mode');
  cfg.display.fontSize    = gV('s-font-size') || 'medium';
  cfg.display.language    = gV('s-language')  || 'id';
  cfg.display.timezone    = gV('s-timezone')  || 'Asia/Jakarta';

  AppStorage.set(SETTINGS_KEY, cfg);
  applyDarkMode(cfg.display.darkMode);
  applyFontSize(cfg.display.fontSize);
  Toast.success('Pengaturan Disimpan', 'Semua perubahan telah disimpan');
}

function populateForm() {
  Helpers.setInputValue('s-name',        cfg.profile.displayName);
  Helpers.setInputValue('s-phone',       cfg.profile.phone);
  Helpers.setInputValue('s-email',       cfg.profile.email);
  Helpers.setInputValue('s-toast-dur',   cfg.notif.toastDuration);
  Helpers.setInputValue('s-alert-level', cfg.notif.alertLevel);
  Helpers.setInputValue('s-font-size',   cfg.display.fontSize);
  Helpers.setInputValue('s-language',    cfg.display.language);
  Helpers.setInputValue('s-timezone',    cfg.display.timezone);

  const dm = document.getElementById('s-dark-mode');
  if (dm) dm.checked = cfg.display.darkMode;
  updateDarkModeUI(cfg.display.darkMode);

  const snd = document.getElementById('s-sound');
  if (snd) snd.checked = cfg.notif.soundEnabled;
}

/* ============================================================ DARK MODE */
function toggleDarkMode() {
  cfg.display.darkMode = !cfg.display.darkMode;
  const cb = document.getElementById('s-dark-mode');
  if (cb) cb.checked = cfg.display.darkMode;
  applyDarkMode(cfg.display.darkMode);
  updateDarkModeUI(cfg.display.darkMode);
  AppStorage.set(SETTINGS_KEY, cfg);
  AppStorage.set(DARK_KEY, cfg.display.darkMode);
  Toast.info('Tampilan', cfg.display.darkMode ? '🌙 Dark mode aktif' : '☀️ Light mode aktif');
}

function applyDarkMode(enabled) {
  document.documentElement.classList.toggle('dark-mode', !!enabled);
  AppStorage.set(DARK_KEY, !!enabled);
}

function applyFontSize(size) {
  const map = { small:'13px', medium:'14px', large:'16px' };
  document.documentElement.style.fontSize = map[size] || '14px';
}

function updateDarkModeUI(enabled) {
  const lbl  = document.getElementById('dark-mode-label');
  const icon = document.getElementById('dark-mode-icon');
  if (lbl)  lbl.textContent  = enabled ? 'Dark Mode Aktif' : 'Light Mode';
  if (icon) icon.className   = `fas ${enabled ? 'fa-moon' : 'fa-sun'}`;
  const wrap = document.getElementById('dark-toggle-wrap');
  if (wrap) wrap.style.background = enabled ? 'rgba(181,101,29,.08)' : '';
}

/* ============================================================ STORAGE INFO */
function renderStorageInfo() {
  const total = Helpers.getDRCCStorageSize();
  Helpers.setInnerText('storage-total', Helpers.formatBytes(total));

  const items = [
    { label:'Insiden',     key:'drcc_incidents',       icon:'fa-triangle-exclamation', color:'#E74C3C' },
    { label:'Sumber Daya', key:'drcc_resources',        icon:'fa-boxes-stacking',       color:'#2980B9' },
    { label:'AI Riwayat',  key:'drcc_ai_history',       icon:'fa-brain',                color:'#B5651D' },
    { label:'Sinyal',      key:'drcc_signals_history',  icon:'fa-satellite-dish',       color:'#9B59B6' },
    { label:'Peta Marker', key:'drcc_map_markers',      icon:'fa-map-location-dot',     color:'#27AE60' },
    { label:'Pengaturan',  key:'drcc_settings',         icon:'fa-gear',                 color:'#6C757D' },
  ];

  const container = document.getElementById('storage-breakdown');
  if (!container) return;

  container.innerHTML = items.map(item => {
    const raw   = localStorage.getItem(item.key) || '';
    const sizeB = (raw.length + item.key.length) * 2;
    const data  = AppStorage.get(item.key, []);
    const count = Array.isArray(data) ? data.length : (data && typeof data==='object' ? Object.keys(data).length : 0);
    return `<div class="storage-item">
      <i class="fas ${item.icon}" style="color:${item.color}"></i>
      <span class="storage-label">${item.label}</span>
      <span class="storage-count">${count} item</span>
      <span class="storage-size">${Helpers.formatBytes(sizeB)}</span>
    </div>`;
  }).join('');
}

/* ============================================================ DATA MANAGEMENT */
function exportAllData()      { Exporter.exportAllJSON();     }
function exportIncidentsCSV() { Exporter.exportIncidents();   }
function exportResourcesCSV() { Exporter.exportResources();   }

function importBackup() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json';
  inp.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      if (Exporter.importJSON(ev.target.result)) renderStorageInfo();
    };
    reader.readAsText(file);
  };
  inp.click();
}

function resetData(key) {
  const labels = {
    drcc_incidents:       'semua insiden',
    drcc_resources:       'semua sumber daya',
    drcc_ai_history:      'riwayat analisis AI',
    drcc_signals_history: 'riwayat sinyal',
    drcc_map_markers:     'marker peta custom',
  };
  showConfirm(`Hapus ${labels[key] || key}?\nTindakan ini TIDAK BISA dibatalkan.`, () => {
    AppStorage.remove(key);
    renderStorageInfo();
    Toast.success('Dihapus', `${labels[key] || key} berhasil dihapus`);
  });
}

function resetAllData() {
  showConfirm('⚠️ HAPUS SEMUA DATA DRCC?\n\nTermasuk insiden, sumber daya, AI, sinyal, dan peta.\nTindakan ini TIDAK BISA dibatalkan!', () => {
    ['drcc_incidents','drcc_resources','drcc_ai_history','drcc_signals_history','drcc_map_markers','drcc_custom_signals'].forEach(k => AppStorage.remove(k));
    renderStorageInfo();
    Toast.success('Reset Selesai', 'Semua data operasional berhasil dihapus');
  });
}

Object.assign(window, {
  initSettings, saveSettings, toggleDarkMode,
  exportAllData, exportIncidentsCSV, exportResourcesCSV,
  importBackup, resetData, resetAllData,
});
