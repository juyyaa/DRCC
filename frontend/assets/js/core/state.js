/* ============================================
   DRCC — state.js (Fullstack version)
   Observable pub/sub — dipakai untuk relay event WebSocket
   ke masing-masing halaman (lihat socket-client.js)
   ============================================ */
'use strict';

const State = {
  _store: {},
  _listeners: {},

  set(key, value) { this._store[key] = value; this._emit(key, value); },
  get(key, fallback = null) { return key in this._store ? this._store[key] : fallback; },

  on(key, cb) {
    (this._listeners[key] = this._listeners[key] || []).push(cb);
    return () => this.off(key, cb);
  },
  off(key, cb) {
    this._listeners[key] = (this._listeners[key] || []).filter(fn => fn !== cb);
  },
  _emit(key, value) {
    (this._listeners[key] || []).forEach(cb => { try { cb(value, key); } catch(e) { console.error('[State listener]', e); } });
  },

  /* Animasi masuk halaman — dipanggil dari buildAppShell */
  animatePageIn() {
    const content = document.getElementById('page-content');
    if (!content) return;
    content.style.opacity = '0';
    content.style.transform = 'translateY(8px)';
    requestAnimationFrame(() => {
      content.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
      content.style.opacity = '1';
      content.style.transform = 'translateY(0)';
    });
  },
};

window.State = State;
