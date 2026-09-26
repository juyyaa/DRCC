/* ============================================
   DRCC — router.js
   Client-side navigation, transitions, page tracking
   ============================================ */
'use strict';

const Router = {
  /* Page definitions */
  PAGES: {
    'dashboard':   { path: 'pages/dashboard.html',   title: 'Dashboard',       section: 'main'   },
    'signals':     { path: 'pages/signals.html',     title: 'Signal Monitor',  section: 'main'   },
    'map':         { path: 'pages/map.html',         title: 'Situation Map',   section: 'main'   },
    'ai-command':  { path: 'pages/ai-command.html',  title: 'AI Command',      section: 'main'   },
    'incidents':   { path: 'pages/incidents.html',   title: 'Insiden',         section: 'ops'    },
    'resources':   { path: 'pages/resources.html',   title: 'Sumber Daya',     section: 'ops'    },
    'predictions': { path: 'pages/predictions.html', title: 'Prediksi',        section: 'ops'    },
    'history':     { path: 'pages/history.html',     title: 'Riwayat',         section: 'system' },
    'settings':    { path: 'pages/settings.html',    title: 'Pengaturan',      section: 'system' },
  },

  currentPageId: null,
  _history: [],

  /* ---- INIT ---- */
  init() {
    this.currentPageId = this._detectCurrentPage();
    // Track visit in session history
    const hist = this._getSessionHistory();
    hist.push({ pageId: this.currentPageId, ts: Date.now() });
    if (hist.length > 20) hist.shift();
    sessionStorage.setItem('drcc_nav_history', JSON.stringify(hist));
    this._history = hist;
  },

  /* ---- NAVIGATE WITH TRANSITION ---- */
  navigate(pageId, options = {}) {
    const page = this.PAGES[pageId];
    if (!page) { console.warn(`[Router] Unknown page: ${pageId}`); return; }

    const root   = getRootPath();
    const target = root + page.path;

    if (!options.instant) {
      // Fade-out current page before navigate
      const content = document.getElementById('page-content');
      if (content) {
        content.style.transition = 'opacity 0.2s ease';
        content.style.opacity    = '0';
      }
      setTimeout(() => { window.location.href = target; }, 200);
    } else {
      window.location.href = target;
    }
  },

  /* ---- CURRENT PAGE DETECTION ---- */
  _detectCurrentPage() {
    const path = window.location.pathname;
    const match = path.match(/pages\/([\w-]+)\.html/);
    const pageId = match ? match[1] : 'dashboard';
    return pageId;
  },

  /* ---- SESSION HISTORY ---- */
  _getSessionHistory() {
    try { return JSON.parse(sessionStorage.getItem('drcc_nav_history') || '[]'); }
    catch { return []; }
  },

  getHistory()    { return this._history; },
  getPrevPage()   { return this._history[this._history.length - 2]?.pageId || null; },
  getCurrentPage(){ return this.currentPageId; },

  /* ---- BREADCRUMB ---- */
  getBreadcrumb() {
    const cur   = this.PAGES[this.currentPageId];
    const prev  = this.PAGES[this.getPrevPage()];
    const crumbs = [{ label: 'DRCC', path: '../index.html' }];
    if (prev)  crumbs.push({ label: prev.title,  path: prev.path  });
    if (cur)   crumbs.push({ label: cur.title,   path: null });
    return crumbs;
  },

  /* ---- PAGE TITLE UPDATER ---- */
  setPageMeta(title, subtitle) {
    document.title = `${title} — DRCC`;
    const tEl = document.getElementById('page-title');
    const sEl = document.getElementById('page-subtitle');
    if (tEl) tEl.textContent = title;
    if (sEl) sEl.textContent = subtitle || '';
  },

  /* ---- LINK ACTIVE STATE ---- */
  updateActiveLinks() {
    document.querySelectorAll('.nav-item').forEach(link => {
      const href = link.getAttribute('href') || '';
      const isActive = href.includes(this.currentPageId + '.html');
      link.classList.toggle('active', isActive);
    });
  },

  /* ---- LOADING OVERLAY ---- */
  showLoading(message = 'Memuat data...') {
    const existing = document.getElementById('page-loader');
    if (existing) return;
    const loader = document.createElement('div');
    loader.id = 'page-loader';
    loader.style.cssText = `
      position:fixed;inset:0;z-index:9000;
      background:rgba(248,249,250,.88);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:14px;backdrop-filter:blur(3px);
    `;
    loader.innerHTML = `
      <div style="width:40px;height:40px;border:3px solid var(--border);border-top-color:var(--copper);border-radius:50%;animation:spin .8s linear infinite"></div>
      <div style="font-size:13px;font-weight:600;color:var(--text-muted)">${message}</div>`;
    document.body.appendChild(loader);
  },

  hideLoading() {
    const loader = document.getElementById('page-loader');
    if (loader) {
      loader.style.transition = 'opacity .2s ease';
      loader.style.opacity    = '0';
      setTimeout(() => loader.remove(), 220);
    }
  },
};

window.Router = Router;
