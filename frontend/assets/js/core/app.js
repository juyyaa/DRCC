/* ============================================
   DRCC — app.js
   Core: Auth, Storage, Toast, Sidebar, Navbar
   ============================================ */

'use strict';

/* ============ CONSTANTS ============ */
const DRCC = {
  version: '2.0.0',

  /* permKey mengacu ke resource key di backend permissions.js — dipakai untuk
     menyaring menu sidebar sesuai permissions yang dikirim API saat login. */
  NAV_ITEMS: [
    { id: 'dashboard',       label: 'Dashboard',       icon: 'fa-gauge-high',           path: 'pages/dashboard.html',       section: 'main',   badge: null,   permKey: 'dashboard' },
    { id: 'signals',         label: 'Signal Monitor',  icon: 'fa-broadcast-tower',      path: 'pages/signals.html',         section: 'main',   badge: 'LIVE', permKey: 'signals' },
    { id: 'map',             label: 'Situation Map',   icon: 'fa-map-marked-alt',       path: 'pages/map.html',             section: 'main',   badge: null,   permKey: 'map' },
    { id: 'ai-command',      label: 'AI Command',      icon: 'fa-brain',                path: 'pages/ai-command.html',      section: 'main',   badge: null,   permKey: 'aiCommand' },
    { id: 'incidents',       label: 'Insiden',         icon: 'fa-triangle-exclamation', path: 'pages/incidents.html',       section: 'ops',    badge: null,   permKey: 'incidents' },
    { id: 'resources',       label: 'Sumber Daya',     icon: 'fa-box-open',             path: 'pages/resources.html',       section: 'ops',    badge: null,   permKey: 'resources' },
    { id: 'predictions',     label: 'Prediksi',        icon: 'fa-chart-line',           path: 'pages/predictions.html',     section: 'ops',    badge: null,   permKey: 'predictions' },
    { id: 'history',         label: 'Riwayat',         icon: 'fa-history',              path: 'pages/history.html',         section: 'system', badge: null,   permKey: 'history' },
    { id: 'demo-center',     label: 'Demo Center UAS', icon: 'fa-rocket',               path: 'pages/demo-center.html',     section: 'system', badge: null,   permKey: 'demoCenter' },
    { id: 'user-management', label: 'Kelola User',     icon: 'fa-users-gear',           path: 'pages/user-management.html', section: 'system', badge: null,   permKey: 'userManagement' },
    { id: 'settings',        label: 'Pengaturan',      icon: 'fa-gear',                 path: 'pages/settings.html',        section: 'system', badge: null,   permKey: 'settings' },
  ],

  SECTION_LABELS: {
    main:   'Operasional',
    ops:    'Manajemen',
    system: 'Sistem',
  },
};

/* ============ STORAGE ============ */
const Storage = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  },
  remove(key) { localStorage.removeItem(key); },
  clearPrefix(prefix) {
    Object.keys(localStorage)
      .filter(k => k.startsWith(prefix))
      .forEach(k => localStorage.removeItem(k));
  },
};

/* ============ AUTH (real API-based) ============ */
const Auth = {
  /**
   * Login ke backend. Role TIDAK lagi dipilih manual — backend yang menentukan
   * berdasarkan akun di database. Mengembalikan Promise<user|null>.
   */
  async login(username, password) {
    const data = await ApiClient.post('/auth/login', { username, password });
    ApiClient.setTokens(data.accessToken, data.refreshToken);
    ApiClient.setUser(data.user, data.permissions);
    return data;
  },

  async logout() {
    try {
      await ApiClient.post('/auth/logout', { refreshToken: ApiClient.getRefreshToken() });
    } catch (e) { /* ignore network errors on logout */ }
    if (window.SocketClient) SocketClient.disconnect();
    ApiClient.clearTokens();
    window.location.href = getRootPath() + 'index.html';
  },

  getSession()  { return ApiClient.getUser(); },
  getPermissions() { return ApiClient.getPermissions(); },
  isLoggedIn()  { return !!ApiClient.getAccessToken() && !!ApiClient.getUser(); },

  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = getRootPath() + 'index.html';
      return false;
    }
    return true;
  },

  /** Refresh /me dari server (dipanggil saat app shell init untuk sinkronisasi profil terbaru) */
  async refreshMe() {
    try {
      const data = await ApiClient.get('/auth/me');
      ApiClient.setUser(data.user, data.permissions);
      return data;
    } catch (e) { return null; }
  },

  getRoleLabel(role) {
    return { admin: 'Admin BNPB', operator: 'Operator', relawan: 'Relawan', pemda: 'Pemda' }[role] || role;
  },

  /** Cek permission untuk resource tertentu, contoh: Auth.can('incidents','manage') */
  can(resourceKey, action = 'view') {
    const perms = this.getPermissions();
    return !!perms?.[resourceKey]?.[action];
  },
};

/* ============ TOAST ============ */
const Toast = {
  container: null,

  init() {
    this.container = document.getElementById('toast-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  show(title, message = '', type = 'default', duration = 4200) {
    if (!this.container) this.init();
    const iconMap = { success:'fa-check', error:'fa-xmark', warning:'fa-triangle-exclamation', info:'fa-circle-info', default:'fa-shield-halved' };
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `
      <div class="toast-icon"><i class="fas ${iconMap[type] || iconMap.default}"></i></div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
      <button class="toast-close" onclick="Toast.remove(this.parentElement)">
        <i class="fas fa-xmark"></i>
      </button>`;
    this.container.appendChild(t);
    if (duration > 0) setTimeout(() => this.remove(t), duration);
    return t;
  },

  remove(el) {
    if (!el || el.classList.contains('removing')) return;
    el.classList.add('removing');
    setTimeout(() => el.remove(), 260);
  },

  success(t, m, d) { return this.show(t, m, 'success', d); },
  error(t, m, d)   { return this.show(t, m, 'error', d); },
  warning(t, m, d) { return this.show(t, m, 'warning', d); },
  info(t, m, d)    { return this.show(t, m, 'info', d); },
};

/* ============ CLOCK ============ */
function startClock() {
  const el = document.getElementById('navbar-clock');
  if (!el) return;
  const tick = () => {
    const now = new Date();
    const time = now.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
    const date = now.toLocaleDateString('id-ID', { weekday:'short', day:'numeric', month:'short' });
    el.textContent = `${date}  ${time}`;
  };
  tick();
  setInterval(tick, 1000);
}

/* ============ SIDEBAR ============ */
const Sidebar = {
  el: null, overlay: null, isCollapsed: false, isMobileOpen: false,

  init() {
    this.el      = document.getElementById('sidebar');
    this.overlay = document.getElementById('sidebar-overlay');
    if (!this.el) return;
    this.isCollapsed = Storage.get('drcc_sidebar_collapsed', false);
    if (this.isCollapsed) this.el.classList.add('collapsed');
    this.overlay?.addEventListener('click', () => this.closeMobile());
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) this.closeMobile();
    });
  },

  toggle() {
    if (window.innerWidth <= 768) this.toggleMobile();
    else this.toggleCollapse();
  },

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    this.el.classList.toggle('collapsed', this.isCollapsed);
    Storage.set('drcc_sidebar_collapsed', this.isCollapsed);
    const icon = document.getElementById('sidebar-toggle-icon');
    if (icon) icon.className = this.isCollapsed ? 'fas fa-angles-right' : 'fas fa-angles-left';
  },

  toggleMobile() {
    this.isMobileOpen = !this.isMobileOpen;
    this.el.classList.toggle('mobile-open', this.isMobileOpen);
    this.overlay?.classList.toggle('active', this.isMobileOpen);
    document.body.style.overflow = this.isMobileOpen ? 'hidden' : '';
  },

  closeMobile() {
    this.isMobileOpen = false;
    this.el.classList.remove('mobile-open');
    this.overlay?.classList.remove('active');
    document.body.style.overflow = '';
  },
};

/* ============ NAVBAR ============ */
const Navbar = {
  init(session) {
    if (!session) return;
    const av = document.getElementById('user-avatar');
    const nm = document.getElementById('user-name');
    const rb = document.getElementById('user-role-badge');
    if (av) av.textContent = session.initials || session.username.slice(0,2).toUpperCase();
    if (nm) nm.textContent = session.name || session.username;
    if (rb) { rb.textContent = Auth.getRoleLabel(session.role); rb.className = `user-role-badge role-${session.role}`; }
    startClock();
  },
};

/* ============ SIDEBAR BUILDER (permission-aware) ============ */
function buildSidebar(activeId) {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;
  const permissions = Auth.getPermissions() || {};
  const root = getRootPath();

  const grouped = {};
  DRCC.NAV_ITEMS.forEach(item => {
    // Hanya tampilkan menu yang permissions.view === true untuk role ini
    const canView = permissions[item.permKey]?.view;
    if (!canView) return;
    if (!grouped[item.section]) grouped[item.section] = [];
    grouped[item.section].push(item);
  });

  let html = '';
  Object.entries(grouped).forEach(([sec, items]) => {
    html += `<div class="nav-section-label">${DRCC.SECTION_LABELS[sec] || sec}</div>`;
    items.forEach(item => {
      const active = item.id === activeId;
      const badgeHtml = item.badge
        ? `<span class="nav-badge ${item.badge === 'LIVE' ? 'live' : ''}">${item.badge}</span>`
        : '';
      html += `
        <a href="${root}${item.path}"
           class="nav-item ${active ? 'active' : ''}"
           data-tooltip="${item.label}">
          <span class="nav-icon"><i class="fas ${item.icon}"></i></span>
          <span class="nav-label">${item.label}</span>
          ${badgeHtml}
        </a>`;
    });
  });
  nav.innerHTML = html;
}

/* ============ APP SHELL INIT ============ */
function buildAppShell(pageId, pageTitle, pageSubtitle) {
  if (!Auth.requireAuth()) return null;
  const session = Auth.getSession();
  document.title = `${pageTitle} — DRCC`;

  buildSidebar(pageId);
  Sidebar.init();
  Navbar.init(session);

  // Hubungkan WebSocket setelah auth terkonfirmasi — real-time mulai aktif
  if (window.SocketClient) SocketClient.connect();

  const titleEl    = document.getElementById('page-title');
  const subtitleEl = document.getElementById('page-subtitle');
  if (titleEl)    titleEl.textContent    = pageTitle;
  if (subtitleEl) subtitleEl.textContent = pageSubtitle || '';
  Toast.init();
  if (window.State) State.animatePageIn();

  // Sinkronisasi profil & permission terbaru dari server di background
  // (role bisa berubah oleh admin saat sesi berjalan) — rebuild sidebar bila berubah
  Auth.refreshMe().then(fresh => {
    if (fresh) { buildSidebar(pageId); Navbar.init(fresh.user); }
  });

  return session;
}

/* ============ LOGIN PAGE ============ */
function initLoginPage() {
  Toast.init();
  if (Auth.isLoggedIn()) { window.location.href = 'pages/dashboard.html'; return; }
  const remembered = Storage.get('drcc_remember_username');
  if (remembered) {
    const uel = document.getElementById('username');
    const rel = document.getElementById('remember-me');
    if (uel) uel.value = remembered;
    if (rel) rel.checked = true;
  }
}async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username')?.value.trim();
  const password = document.getElementById('password')?.value;
  const remember = document.getElementById('remember-me')?.checked;

  clearLoginError();
  if (!username || !password) { showLoginError('Username dan password wajib diisi.'); return; }

  setLoginLoading(true);

  try {
    const data = await Auth.login(username, password);

    if (remember) Storage.set('drcc_remember_username', username);
    else Storage.remove('drcc_remember_username');

    Toast.success('Login Berhasil', `Selamat datang, ${data.user.name}`);
    setTimeout(() => { window.location.href = 'pages/dashboard.html'; }, 600);
  } catch (err) {
    setLoginLoading(false);
    showLoginError(err.message || 'Username atau password salah.');
    document.getElementById('username')?.classList.add('error');
    document.getElementById('password')?.classList.add('error');
  }
}

function setLoginLoading(on) {
  const btnText    = document.querySelector('.btn-text');
  const btnLoading = document.querySelector('.btn-loading');
  const btn        = document.getElementById('btn-login');
  if (btnText)    btnText.style.display    = on ? 'none'  : 'flex';
  if (btnLoading) btnLoading.style.display = on ? 'flex'  : 'none';
  if (btn)        btn.disabled = on;
}

function showLoginError(msg) {
  const el  = document.getElementById('login-error');
  const msg_el = document.getElementById('error-msg');
  if (!el) return;
  if (msg_el) msg_el.textContent = msg;
  el.style.display = 'flex';
  el.classList.remove('anim-shake');
  void el.offsetWidth;
  el.classList.add('anim-shake');
}

function clearLoginError() {
  const el = document.getElementById('login-error');
  if (el) el.style.display = 'none';
  document.getElementById('username')?.classList.remove('error');
  document.getElementById('password')?.classList.remove('error');
}

function togglePassword() {
  const inp  = document.getElementById('password');
  const icon = document.getElementById('pwd-icon');
  if (!inp || !icon) return;
  const hidden = inp.type === 'password';
  inp.type   = hidden ? 'text'     : 'password';
  icon.className = hidden ? 'fas fa-eye-slash' : 'fas fa-eye';
}

function toggleDemo() {
  const creds   = document.getElementById('demo-creds');
  const chevron = document.getElementById('demo-chevron');
  if (!creds || !chevron) return;
  const collapsed = creds.classList.contains('collapsed');
  creds.classList.toggle('collapsed', !collapsed);
  chevron.className = collapsed ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
}

/* ============ UTILITY FUNCTIONS ============ */
function getRootPath() {
  return window.location.pathname.includes('/pages/') ? '../' : '';
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
}

function formatDateTime(ts) {
  return new Date(ts).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function formatTimeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d} hari lalu`;
  if (h > 0) return `${h} jam lalu`;
  if (m > 0) return `${m} mnt lalu`;
  return 'Baru saja';
}

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + ' jt';
  if (n >= 1000)    return (n / 1000).toFixed(1) + ' rb';
  return n.toLocaleString('id-ID');
}

function debounce(fn, wait) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

function generateId(prefix = 'drcc') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
}

function showConfirm(msg, onConfirm, onCancel) {
  if (window.confirm(msg)) onConfirm?.();
  else onCancel?.();
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).then(() => {
    Toast.success('Tersalin!', 'Teks berhasil disalin ke clipboard');
  }).catch(() => {
    Toast.error('Gagal', 'Tidak dapat menyalin teks');
  });
}

/* ============ EXPOSE GLOBALS ============ */
Object.assign(window, {
  DRCC, Storage, Auth, Toast, Sidebar, Navbar,
  buildAppShell, buildSidebar, initLoginPage,
  handleLogin,
  togglePassword, toggleDemo, clearLoginError,
  getRootPath, formatDate, formatDateTime,
  formatTimeAgo, formatNumber, debounce,
  generateId, showConfirm, escapeHtml, copyToClipboard,
  startClock,
});

/* ============================================================
   NAVBAR EXTRAS — Notification Dropdown (API-based) + Help Modal
   ============================================================ */

/* Wire bell + help buttons after Navbar.init renders the navbar */
const _origNavbarInit = Navbar.init.bind(Navbar);
Navbar.init = function(session) {
  _origNavbarInit(session);
  requestAnimationFrame(() => {
    const bell = document.querySelector('.navbar-btn[title="Notifikasi"]');
    const help = document.querySelector('.navbar-btn[title="Bantuan"]');
    if (bell && !bell._notifBound) {
      bell._notifBound = true;
      bell.style.position = 'relative';
      bell.addEventListener('click', (e) => { e.stopPropagation(); toggleNotifDropdown(bell); });
    }
    if (help && !help._helpBound) {
      help._helpBound = true;
      help.addEventListener('click', showHelpModal);
    }
    document.addEventListener('click', () => { document.getElementById('notif-dd')?.remove(); }, { passive: true });
  });

  // Ambil unread count terbaru dari server saat navbar dibangun
  if (window.ApiClient) {
    ApiClient.get('/notifications').then(data => {
      const badge = document.getElementById('notif-badge');
      if (badge) {
        badge.textContent = data.unreadCount > 99 ? '99+' : data.unreadCount;
        badge.style.display = data.unreadCount > 0 ? '' : 'none';
      }
    }).catch(() => {});
  }
};

async function toggleNotifDropdown(btn) {
  const existing = document.getElementById('notif-dd');
  if (existing) { existing.remove(); return; }

  let notifs = [];
  try { const data = await ApiClient.get('/notifications'); notifs = data.notifications; } catch (e) {}

  const icons  = { success:'fa-check-circle', error:'fa-circle-xmark', warning:'fa-triangle-exclamation', info:'fa-circle-info' };
  const colors = { success:'#27AE60', error:'#E74C3C', warning:'#E67E22', info:'#2980B9' };

  const dd = document.createElement('div');
  dd.id = 'notif-dd';
  dd.style.cssText = 'position:absolute;top:calc(100% + 8px);right:0;width:300px;max-height:380px;overflow-y:auto;background:var(--dark-1,#1C2431);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.08);z-index:800';

  const items = notifs.slice(0, 10);
  const body = items.length
    ? items.map(n => `<div style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;gap:8px;${n.is_read?'opacity:.55':''}">
        <i class="fas ${icons[n.type]||icons.info}" style="color:${colors[n.type]||colors.info};flex-shrink:0;margin-top:2px"></i>
        <div><div style="font-size:12px;font-weight:700;color:#e2e8f0">${n.title}</div>
        ${n.message?`<div style="font-size:11px;color:#94a3b8;margin-top:1px">${n.message}</div>`:''}
        <div style="font-size:10px;color:#64748b;margin-top:3px">${new Date(n.created_at).toLocaleString('id-ID',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'})}</div></div>
      </div>`).join('')
    : '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px">Tidak ada notifikasi</div>';

  dd.innerHTML = `<div style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:12px;font-weight:700;color:rgba(255,255,255,.7)">Notifikasi</span>
      <button onclick="markAllNotifRead()" style="background:none;border:none;color:rgba(255,255,255,.4);cursor:pointer;font-size:11px">Tandai semua dibaca</button>
    </div>${body}`;

  btn.appendChild(dd);
  dd.addEventListener('click', e => e.stopPropagation());
}

async function markAllNotifRead() {
  try {
    await ApiClient.post('/notifications/mark-all-read', {});
    document.getElementById('notif-badge')?.style && (document.getElementById('notif-badge').style.display = 'none');
    document.getElementById('notif-dd')?.remove();
  } catch (e) {}
}

/* Help modal — panduan + demo credentials */
window.showHelpModal = function() {
  if (document.getElementById('help-modal')) return;
  const m = document.createElement('div');
  m.id = 'help-modal';
  m.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px';
  m.innerHTML = `
    <div style="background:var(--surface);border-radius:16px;padding:24px;max-width:440px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:10px">
          <i class="fas fa-circle-question" style="color:var(--copper);font-size:20px"></i>
          <h3 style="font-size:16px;font-weight:800;color:var(--text)">Panduan DRCC</h3>
        </div>
        <button onclick="document.getElementById('help-modal').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px">✕</button>
      </div>
      <div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Halaman Utama</div>
      <div style="font-size:12px;color:var(--text-muted);line-height:1.8">
        📡 <b>Signal Monitor</b> — Layer 1 & 2: input sinyal + processing<br>
        🤖 <b>AI Command</b> — Layer 3 & 4: reasoning (Gemini) + decision tree<br>
        🚀 <b>Demo Center</b> — Jalankan 10 skenario UAS (Admin/Operator)<br>
        📋 <b>Insiden</b> — Manajemen insiden bencana real-time<br>
        🗺 <b>Situation Map</b> — Peta real-time, sinkron antar semua user<br>
        ⚙️ <b>Pengaturan</b> — Dark mode, profil, password, export data
      </div>
    </div>`;
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  document.body.appendChild(m);
};

/* Form error helpers (dipakai validasi inline di berbagai form) */
window.showFieldError = function(fieldId, message) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.classList.add('error-shake', 'invalid');
  setTimeout(() => el.classList.remove('error-shake'), 500);
  let errEl = el.parentElement?.querySelector('.field-error-msg');
  if (!errEl) { errEl = document.createElement('div'); errEl.className = 'field-error-msg'; el.parentElement?.appendChild(errEl); }
  errEl.innerHTML = `<i class="fas fa-circle-exclamation"></i>${message}`;
  errEl.style.display = 'flex';
};

window.clearFieldError = function(fieldId) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.classList.remove('invalid');
  el.parentElement?.querySelector('.field-error-msg')?.remove();
};

Object.assign(window, { toggleNotifDropdown, markAllNotifRead });
