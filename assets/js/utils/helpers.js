/* ============================================
   DRCC — helpers.js
   General utility functions for all modules
   ============================================ */
'use strict';

const Helpers = {

  /* ---- PAGINATION ---- */
  paginate(arr, page = 1, perPage = 10) {
    const total      = arr.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const safePage   = Math.min(Math.max(page, 1), totalPages);
    const start      = (safePage - 1) * perPage;
    return {
      items:      arr.slice(start, start + perPage),
      page:       safePage,
      perPage,
      total,
      totalPages,
      hasNext:    safePage < totalPages,
      hasPrev:    safePage > 1,
    };
  },

  /* ---- ARRAY HELPERS ---- */
  groupBy(arr, key) {
    return arr.reduce((acc, item) => {
      const k = typeof key === 'function' ? key(item) : item[key];
      (acc[k] = acc[k] || []).push(item);
      return acc;
    }, {});
  },

  sortBy(arr, key, dir = 'desc') {
    return [...arr].sort((a, b) => {
      const va = a[key], vb = b[key];
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return dir === 'asc' ? cmp : -cmp;
    });
  },

  unique(arr, key) {
    const seen = new Set();
    return arr.filter(item => {
      const k = key ? item[key] : item;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  },

  /* ---- STRING HELPERS ---- */
  truncate(str, len = 60, suffix = '…') {
    if (!str) return '';
    return str.length <= len ? str : str.slice(0, len) + suffix;
  },

  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  slugify(str) {
    return str.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  },

  /* ---- NUMBER HELPERS ---- */
  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  },

  roundTo(num, decimals = 2) {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
  },

  /* ---- FILE / SIZE HELPERS ---- */
  formatBytes(bytes) {
    if (bytes < 1024)       return `${bytes} B`;
    if (bytes < 1048576)    return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  },

  getStorageSize(prefix = '') {
    let total = 0;
    for (const key in localStorage) {
      if (!localStorage.hasOwnProperty(key)) continue;
      if (prefix && !key.startsWith(prefix)) continue;
      total += (localStorage[key].length + key.length) * 2;
    }
    return total;
  },

  getDRCCStorageSize() {
    return this.getStorageSize('drcc_');
  },

  /* ---- DATE HELPERS ---- */
  startOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  },

  endOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  },

  daysBetween(ts1, ts2) {
    return Math.abs(Math.floor((ts2 - ts1) / 86400000));
  },

  isToday(ts) {
    return new Date(ts).toDateString() === new Date().toDateString();
  },

  /* ---- OBJECT HELPERS ---- */
  deepClone(obj) {
    try { return JSON.parse(JSON.stringify(obj)); }
    catch { return obj; }
  },

  pick(obj, keys) {
    return keys.reduce((acc, k) => { if (k in obj) acc[k] = obj[k]; return acc; }, {});
  },

  omit(obj, keys) {
    const keySet = new Set(keys);
    return Object.fromEntries(Object.entries(obj).filter(([k]) => !keySet.has(k)));
  },

  /* ---- DOM HELPERS ---- */
  setInnerText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  },

  setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value ?? '';
  },

  getInputValue(id) {
    return document.getElementById(id)?.value?.trim() || '';
  },
};

window.Helpers = Helpers;
