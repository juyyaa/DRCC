/* ============================================
   DRCC — storage.js
   LocalStorage CRUD helpers — semua modul
   ============================================ */

'use strict';

const AppStorage = {

  /* ---- GENERIC CRUD ---- */
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

  has(key) { return localStorage.getItem(key) !== null; },

  list(prefix = '') {
    return Object.keys(localStorage)
      .filter(k => k.startsWith(prefix));
  },

  /* ---- COLLECTION HELPERS (array-based) ---- */
  getCollection(key) {
    return this.get(key, []);
  },

  addToCollection(key, item) {
    const col = this.getCollection(key);
    col.push(item);
    return this.set(key, col);
  },

  updateInCollection(key, id, updates) {
    const col = this.getCollection(key);
    const idx = col.findIndex(i => i.id === id);
    if (idx === -1) return false;
    col[idx] = { ...col[idx], ...updates };
    return this.set(key, col);
  },

  removeFromCollection(key, id) {
    const col = this.getCollection(key).filter(i => i.id !== id);
    return this.set(key, col);
  },

  findInCollection(key, predicate) {
    return this.getCollection(key).find(predicate) || null;
  },

  /* ---- SIGNAL-SPECIFIC HELPERS ---- */
  signals: {
    KEYS: {
      CUSTOM:   'drcc_custom_signals',
      HISTORY:  'drcc_sig_history',   // prefix; appended with signalId
      ACTIVE:   'drcc_sig_active',
      PRIORITY: 'drcc_sig_priority',
    },

    /* Custom signals CRUD */
    getCustom()         { return AppStorage.getCollection(this.KEYS.CUSTOM); },
    addCustom(sig)      { return AppStorage.addToCollection(this.KEYS.CUSTOM, sig); },
    removeCustom(id)    { return AppStorage.removeFromCollection(this.KEYS.CUSTOM, id); },
    clearCustom()       { return AppStorage.remove(this.KEYS.CUSTOM); },

    /* Active/inactive states { id: boolean } */
    getActiveStates()   { return AppStorage.get(this.KEYS.ACTIVE, {}); },
    setActiveState(id, active) {
      const s = this.getActiveStates();
      s[id] = active;
      return AppStorage.set(this.KEYS.ACTIVE, s);
    },

    /* History per signal */
    getHistory(signalId) {
      return AppStorage.get(`${this.KEYS.HISTORY}_${signalId}`, []);
    },
    saveHistory(signalId, history) {
      return AppStorage.set(`${this.KEYS.HISTORY}_${signalId}`, history.slice(-80));
    },
    clearHistory(signalId) {
      if (signalId) AppStorage.remove(`${this.KEYS.HISTORY}_${signalId}`);
      else {
        AppStorage.list(this.KEYS.HISTORY).forEach(k => AppStorage.remove(k));
      }
    },
  },

  /* ---- UTILITY ---- */
  clear(prefix = null) {
    if (prefix) this.list(prefix).forEach(k => this.remove(k));
    else localStorage.clear();
  },

  sizeKB() {
    let total = 0;
    for (const key in localStorage) {
      if (!localStorage.hasOwnProperty(key)) continue;
      total += (localStorage[key].length + key.length) * 2;
    }
    return (total / 1024).toFixed(2);
  },

  exportAll() {
    const data = {};
    this.list('drcc_').forEach(k => { data[k] = this.get(k); });
    return JSON.stringify(data, null, 2);
  },
};

window.AppStorage = AppStorage;
