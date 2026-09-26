/* ============================================
   DRCC — app.js
   Core: Auth, Storage, Toast, Sidebar, Navbar
   ============================================ */

'use strict';

/* ============ CONSTANTS ============ */
const DRCC = {
  version: '1.0.0',

  ACCOUNTS: [
    { username: 'admin',    password: 'admin123', role: 'admin',    name: 'Administrator',     initials: 'AD' },
    { username: 'operator', password: 'op123',    role: 'operator', name: 'Operator Posko',    initials: 'OP' },
    { username: 'relawan',  password: 'rel123',   role: 'relawan',  name: 'Relawan Lapangan',  initials: 'RL' },
    { username: 'pemda',    password: 'pem123',   role: 'pemda',    name: 'Pemerintah Daerah', initials: 'PD' },
  ],

  NAV_ITEMS: [
    { id: 'dashboard',   label: 'Dashboard',       icon: 'fa-gauge-high',           path: 'pages/dashboard.html',    section: 'main',   badge: null },
    { id: 'signals',     label: 'Signal Monitor',   icon: 'fa-satellite-dish',       path: 'pages/signals.html',      section: 'main',   badge: 'LIVE' },
    { id: 'map',         label: 'Situation Map',    icon: 'fa-map-location-dot',     path: 'pages/map.html',          section: 'main',   badge: null },
    { id: 'ai-command',  label: 'AI Command',       icon: 'fa-brain',                path: 'pages/ai-command.html',   section: 'main',   badge: null },
    { id: 'incidents',   label: 'Insiden',          icon: 'fa-triangle-exclamation', path: 'pages/incidents.html',    section: 'ops',    badge: null },
    { id: 'resources',   label: 'Sumber Daya',      icon: 'fa-boxes-stacking',       path: 'pages/resources.html',    section: 'ops',    badge: null },
    { id: 'predictions', label: 'Prediksi',         icon: 'fa-chart-line',           path: 'pages/predictions.html',  section: 'ops',    badge: null },
    { id: 'history',     label: 'Riwayat',          icon: 'fa-clock-rotate-left',    path: 'pages/history.html',      section: 'system', badge: null },
    { id: 'settings',    label: 'Pengaturan',       icon: 'fa-gear',                 path: 'pages/settings.html',     section: 'system', badge: null },
  ],

  SECTION_LABELS: {
    main:   'Operasional',
    ops:    'Manajemen',
    system: 'Sistem',
  },

  STORAGE_KEY:  'drcc_session',
  REMEMBER_KEY: 'drcc_remember',
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

/* ============ AUTH ============ */
const Auth = {
  login(username, password, role) {
    const account = DRCC.ACCOUNTS.find(
      a => a.username === username && a.password === password && a.role === role
    );
    if (!account) return null;
    const session = { ...account, loginTime: Date.now(), sessionId: Math.random().toString(36).slice(2) };
    Storage.set(DRCC.STORAGE_KEY, session);
    return session;
  },

  logout() {
    Storage.remove(DRCC.STORAGE_KEY);
    window.location.href = getRootPath() + 'index.html';
  },

  getSession() { return Storage.get(DRCC.STORAGE_KEY); },
  isLoggedIn()  { return !!Storage.get(DRCC.STORAGE_KEY); },

  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = getRootPath() + 'index.html';
      return false;
    }
    return true;
  },

  getRoleLabel(role) {
    return { admin: 'Admin BNPB', operator: 'Operator', relawan: 'Relawan', pemda: 'Pemda' }[role] || role;
  },

  canAccess(feature, role) {
    const perms = {
      settings: ['admin', 'operator', 'pemda'],
      ai_command: ['admin', 'operator'],
    };
    return !perms[feature] || perms[feature].includes(role);
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

/* ============ SIDEBAR BUILDER ============ */
function buildSidebar(activeId) {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;
  const session = Auth.getSession();
  const root    = getRootPath();

  const grouped = {};
  DRCC.NAV_ITEMS.forEach(item => {
    if (item.id === 'settings' && session?.role === 'relawan') return;
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
  const titleEl    = document.getElementById('page-title');
  const subtitleEl = document.getElementById('page-subtitle');
  if (titleEl)    titleEl.textContent    = pageTitle;
  if (subtitleEl) subtitleEl.textContent = pageSubtitle || '';
  Toast.init();
  return session;
}

/* ============ LOGIN PAGE ============ */
function initLoginPage() {
  Toast.init();
  if (Auth.isLoggedIn()) { window.location.href = 'pages/dashboard.html'; return; }
  const remembered = Storage.get(DRCC.REMEMBER_KEY);
  if (remembered) {
    const uel = document.getElementById('username');
    const rel = document.getElementById('remember-me');
    if (uel) uel.value = remembered.username;
    if (rel) rel.checked = true;
    const roleBtn = document.querySelector(`.role-btn[data-role="${remembered.role}"]`);
    if (roleBtn) _selectRoleBtn(roleBtn);
  }
}

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username')?.value.trim();
  const password = document.getElementById('password')?.value;
  const role     = document.getElementById('selected-role')?.value;
  const remember = document.getElementById('remember-me')?.checked;

  clearLoginError();
  if (!username || !password) { showLoginError('Username dan password wajib diisi.'); return; }

  setLoginLoading(true);

  setTimeout(() => {
    const session = Auth.login(username, password, role);
    if (!session) {
      setLoginLoading(false);
      showLoginError('Username, password, atau role tidak cocok.');
      document.getElementById('username')?.classList.add('error');
      document.getElementById('password')?.classList.add('error');
      return;
    }
    if (remember) Storage.set(DRCC.REMEMBER_KEY, { username, role });
    else Storage.remove(DRCC.REMEMBER_KEY);

    Toast.success('Login Berhasil', `Selamat datang, ${session.name}`);
    setTimeout(() => { window.location.href = 'pages/dashboard.html'; }, 750);
  }, 600);
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

function fillCredentials(username, password, role) {
  const uel = document.getElementById('username');
  const pel = document.getElementById('password');
  if (uel) uel.value = username;
  if (pel) pel.value = password;
  const roleBtn = document.querySelector(`.role-btn[data-role="${role}"]`);
  if (roleBtn) _selectRoleBtn(roleBtn);
  clearLoginError();
  Toast.info('Demo diisi', `Login sebagai ${Auth.getRoleLabel(role)}`);
}

function selectRole(btn) { _selectRoleBtn(btn); }

function _selectRoleBtn(btn) {
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const inp = document.getElementById('selected-role');
  if (inp) inp.value = btn.dataset.role;
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
  handleLogin, fillCredentials, selectRole,
  togglePassword, toggleDemo, clearLoginError,
  getRootPath, formatDate, formatDateTime,
  formatTimeAgo, formatNumber, debounce,
  generateId, showConfirm, escapeHtml, copyToClipboard,
  startClock,
});

/* ============================================================
   SESSION 8 ADDITIONS — State, Router, Dark Mode, Notifications
   ============================================================ */

/* Override buildAppShell to integrate State + Router + Dark mode */
const _origBuildAppShell = buildAppShell;
window.buildAppShell = function(pageId, pageTitle, pageSubtitle) {
  const session = _origBuildAppShell(pageId, pageTitle, pageSubtitle);

  /* 1. Apply saved dark mode immediately */
  const dm = Storage.get('drcc_dark_mode', false);
  if (dm) document.documentElement.classList.add('dark-mode');

  /* 2. Initialize Router */
  if (window.Router) {
    Router.init();
  }

  /* 3. Initialize State: cross-tab sync + notification badge */
  if (window.State) {
    State.initSync();
    State.initBadge();
    State.initErrorHandler();
    State.animatePageIn();
  }

  /* 4. Run API integrity check silently */
  if (window.API) {
    setTimeout(() => API.validateIntegrity(), 800);
  }

  /* 5. Wire notification bell click */
  setTimeout(() => {
    const btn    = document.getElementById('notif-btn') || document.querySelector('.navbar-btn[title="Notifikasi"]');
    const noShow = document.getElementById('notif-dropdown');
    if (btn && !noShow && window.State) {
      btn.style.position = 'relative';
      btn.addEventListener('click', toggleNotifDropdown);
      document.addEventListener('click', (e) => {
        if (!btn.contains(e.target)) closeNotifDropdown();
      });
    }
  }, 0);

  return session;
};

function toggleNotifDropdown() {
  let dd = document.getElementById('notif-dropdown');
  if (dd) { dd.classList.toggle('hidden'); return; }

  dd = document.createElement('div');
  dd.id = 'notif-dropdown';
  dd.className = 'notif-dropdown';
  dd.innerHTML = `
    <div class="notif-dropdown-header">
      <span>Notifikasi</span>
      <button onclick="State.notifications.markAllRead();document.getElementById('notif-dropdown')?.remove()" style="background:none;border:none;color:rgba(255,255,255,.5);cursor:pointer;font-size:11px">Tandai semua dibaca</button>
    </div>
    ${State.notifications.renderDropdown()}`;

  const btn = document.getElementById('notif-btn') || document.querySelector('.navbar-btn[title="Notifikasi"]');
  if (btn) {
    btn.style.position = 'relative';
    btn.appendChild(dd);
  }
}

function closeNotifDropdown() {
  document.getElementById('notif-dropdown')?.remove();
}

/* Enhanced form error helper */
window.showFieldError = function(fieldId, message) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.classList.add('error-shake', 'invalid');
  setTimeout(() => el.classList.remove('error-shake'), 500);
  let errEl = el.parentElement?.querySelector('.field-error-msg');
  if (!errEl) {
    errEl = document.createElement('div');
    errEl.className = 'field-error-msg';
    el.parentElement?.appendChild(errEl);
  }
  errEl.innerHTML = `<i class="fas fa-circle-exclamation"></i>${message}`;
  errEl.style.display = 'flex';
};

window.clearFieldError = function(fieldId) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.classList.remove('invalid');
  el.parentElement?.querySelector('.field-error-msg')?.remove();
};
