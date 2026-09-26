/* ============================================
   DRCC — state.js
   Shared state, cross-tab sync, notification system
   ============================================ */
'use strict';

const State = {
  _store: {},
  _listeners: {},

  /* ---- IN-PAGE STATE STORE ---- */
  set(key, value) {
    this._store[key] = value;
    this._emit(key, value);
    this._emit('*', { key, value });
  },

  get(key, fallback = null) {
    return key in this._store ? this._store[key] : fallback;
  },

  update(key, partial) {
    const current = this.get(key, {});
    this.set(key, { ...current, ...partial });
  },

  on(key, cb) {
    (this._listeners[key] = this._listeners[key] || []).push(cb);
    return () => this.off(key, cb);
  },

  off(key, cb) {
    this._listeners[key] = (this._listeners[key] || []).filter(fn => fn !== cb);
  },

  _emit(key, value) {
    (this._listeners[key] || []).forEach(cb => { try { cb(value, key); } catch(e){} });
  },

  /* ---- CROSS-TAB SYNC (StorageEvent) ---- */
  initSync() {
    window.addEventListener('storage', (e) => {
      if (!e.key) return;
      // Broadcast storage change to in-page listeners
      this._emit(`storage:${e.key}`, { key: e.key, newVal: e.newValue, oldVal: e.oldValue });
      this._emit('storage:any', e);

      // Auto-refresh notifications badge
      if (e.key === 'drcc_notifications') {
        const notifs = this._parseJSON(e.newValue, []);
        const unread  = notifs.filter(n => !n.read).length;
        this._updateBadge(unread);
      }

      // Real-time incident/resource count updates
      if (e.key === 'drcc_incidents' || e.key === 'drcc_resources') {
        this._emit('data:updated', e.key);
      }
    });
  },

  _parseJSON(str, fallback) {
    try { return JSON.parse(str); } catch { return fallback; }
  },

  /* ---- NOTIFICATION SYSTEM ---- */
  notifications: {
    STORE_KEY: 'drcc_notifications',

    push(type, title, message = '') {
      const all = AppStorage.get(this.STORE_KEY, []);
      all.unshift({ id: Date.now(), type, title, message, ts: Date.now(), read: false });
      if (all.length > 60) all.splice(60);
      AppStorage.set(this.STORE_KEY, all);
      // Trigger in-page update (same tab)
      const unread = all.filter(n => !n.read).length;
      State._updateBadge(unread);
    },

    getAll()          { return AppStorage.get(this.STORE_KEY, []); },
    getUnreadCount()  { return this.getAll().filter(n => !n.read).length; },

    markAllRead() {
      const all = this.getAll().map(n => ({ ...n, read: true }));
      AppStorage.set(this.STORE_KEY, all);
      State._updateBadge(0);
    },

    clear() {
      AppStorage.set(this.STORE_KEY, []);
      State._updateBadge(0);
    },

    // Build dropdown HTML
    renderDropdown() {
      const items = this.getAll().slice(0, 8);
      const icons  = { success:'fa-check-circle', error:'fa-circle-xmark', warning:'fa-triangle-exclamation', info:'fa-circle-info' };
      const colors = { success:'var(--success)', error:'var(--danger)', warning:'var(--warning)', info:'var(--info)' };

      if (!items.length) return `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">Tidak ada notifikasi</div>`;

      return items.map(n => `
        <div style="display:flex;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);${n.read?'opacity:.6':''}">
          <i class="fas ${icons[n.type]||icons.info}" style="color:${colors[n.type]||colors.info};margin-top:2px;flex-shrink:0"></i>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:700;color:var(--text)">${n.title}</div>
            ${n.message?`<div style="font-size:11px;color:var(--text-muted);margin-top:1px">${n.message}</div>`:''}
            <div style="font-size:10px;color:var(--text-light);margin-top:3px">${formatTimeAgo(n.ts)}</div>
          </div>
        </div>`).join('');
    },
  },

  /* ---- BADGE UPDATER ---- */
  _updateBadge(count) {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = count > 0 ? '' : 'none';
  },

  /* ---- INIT BADGE ON PAGE LOAD ---- */
  initBadge() {
    const unread = this.notifications.getUnreadCount();
    this._updateBadge(unread);
  },

  /* ---- PAGE ENTRY ANIMATION ---- */
  animatePageIn() {
    const content = document.getElementById('page-content');
    if (!content) return;
    content.style.opacity = '0';
    content.style.transform = 'translateY(8px)';
    requestAnimationFrame(() => {
      content.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
      content.style.opacity    = '1';
      content.style.transform  = 'translateY(0)';
    });
  },

  /* ---- GLOBAL ERROR HANDLER ---- */
  initErrorHandler() {
    window.addEventListener('error', (e) => {
      console.error('[DRCC Error]', e.message, e.filename, e.lineno);
    });

    window.addEventListener('unhandledrejection', (e) => {
      console.warn('[DRCC Promise]', e.reason);
      e.preventDefault();
    });
  },
};

window.State = State;
