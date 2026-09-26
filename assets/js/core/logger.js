/* ============================================
   DRCC — logger.js
   System activity logger — semua aksi user + layer tracking
   ============================================ */
'use strict';

const Logger = {
  KEY: 'drcc_activity_log',
  MAX: 500,

  LAYER_NAMES: {
    1: 'Layer 1: Input Signal',
    2: 'Layer 2: Signal Processing',
    3: 'Layer 3: AI Agent',
    4: 'Layer 4: Prediction/Decision',
    5: 'Layer 5: User Action',
    0: 'System',
  },

  _entry(action, data = {}, layer = 0) {
    return {
      id:        `LOG-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      ts:        Date.now(),
      action,
      data:      typeof data === 'object' ? { ...data } : { value: data },
      layer,
      layerName: this.LAYER_NAMES[layer] || 'System',
      page:      this._page(),
      user:      (window.Auth?.getSession()?.username) || 'system',
      level:     data?.level || 'info',
    };
  },

  _save(entry) {
    try {
      const logs = JSON.parse(localStorage.getItem(this.KEY) || '[]');
      logs.unshift(entry);
      if (logs.length > this.MAX) logs.splice(this.MAX);
      localStorage.setItem(this.KEY, JSON.stringify(logs));
      if (window.State) State._emit('log:new', entry);
    } catch (e) { console.warn('[Logger]', e); }
  },

  log(action, data = {}, layer = 0)  { const e=this._entry(action,data,layer); this._save(e); return e; },
  info(action, data, layer)           { return this.log(action,{...data,level:'info'},layer); },
  warn(action, data, layer)           { return this.log(action,{...data,level:'warn'},layer); },
  error(action, data, layer)          { return this.log(action,{...data,level:'error'},layer); },
  signal(action, data)                { return this.log(action,data,1); },
  processing(action, data)            { return this.log(action,data,2); },
  ai(action, data)                    { return this.log(action,data,3); },
  decision(action, data)              { return this.log(action,data,4); },
  action(actionName, data)            { return this.log(actionName,data,5); },

  getAll()           { try { return JSON.parse(localStorage.getItem(this.KEY)||'[]'); } catch { return []; } },
  getByLayer(l)      { return this.getAll().filter(e => e.layer === l); },
  getRecent(n = 30)  { return this.getAll().slice(0, n); },
  count()            { return this.getAll().length; },

  getLayerStats() {
    const all = this.getAll();
    const stats = { total: all.length };
    for (let i = 0; i <= 5; i++) {
      stats[i] = all.filter(e => e.layer === i).length;
    }
    return stats;
  },

  clear() { localStorage.setItem(this.KEY, '[]'); },

  _page() {
    const m = window.location.pathname.match(/pages\/([\w-]+)\.html/);
    return m ? m[1] : 'root';
  },
};

window.Logger = Logger;
