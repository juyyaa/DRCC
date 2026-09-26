/* ============================================
   DRCC — api.js
   Unified data API — CRUD, stats, cross-module integrity
   ============================================ */
'use strict';

const API = {

  /* ============================================================
     INCIDENTS
  ============================================================ */
  incidents: {
    _key: 'drcc_incidents',

    getAll()         { return AppStorage.get(this._key, []); },
    getById(id)      { return this.getAll().find(i => i.id === id) || null; },

    create(data) {
      const all   = this.getAll();
      const idNum = String(all.length + 1).padStart(3, '0');
      const item  = {
        id:         `INC-${idNum}`,
        ...data,
        assignedResources: data.assignedResources || [],
        createdAt:  Date.now(),
        updatedAt:  Date.now(),
      };
      if (!Validators.incidentTitle(item.title)) throw new Error('Judul insiden tidak valid');
      if (!Validators.severity(item.severity))   throw new Error('Severity tidak valid');
      all.unshift(item);
      AppStorage.set(this._key, all);
      State.notifications.push('warning', 'Insiden Baru', `${item.title} — ${item.severity}`);
      State._emit('data:updated', this._key);
      return item;
    },

    update(id, updates) {
      const all = this.getAll();
      const idx = all.findIndex(i => i.id === id);
      if (idx < 0) return null;
      all[idx] = { ...all[idx], ...updates, updatedAt: Date.now() };
      AppStorage.set(this._key, all);
      State._emit('data:updated', this._key);
      return all[idx];
    },

    delete(id) {
      const item  = this.getById(id);
      if (!item) return false;
      // Unassign all linked resources
      (item.assignedResources || []).forEach(resId => {
        API.resources.unassign(resId);
      });
      AppStorage.set(this._key, this.getAll().filter(i => i.id !== id));
      State._emit('data:updated', this._key);
      return true;
    },

    getByStatus(s)   { return this.getAll().filter(i => i.status   === s); },
    getByType(t)     { return this.getAll().filter(i => i.type     === t); },
    getBySeverity(s) { return this.getAll().filter(i => i.severity === s); },
    getActive()      { return this.getByStatus('aktif'); },

    getStats() {
      const all = this.getAll();
      return {
        total:     all.length,
        aktif:     all.filter(i => i.status   === 'aktif').length,
        ditangani: all.filter(i => i.status   === 'ditangani').length,
        selesai:   all.filter(i => i.status   === 'selesai').length,
        bahaya:    all.filter(i => i.severity === 'BAHAYA').length,
        waspada:   all.filter(i => i.severity === 'WASPADA').length,
        totalAffected: all.reduce((s, i) => s + (i.affected || 0), 0),
      };
    },
  },

  /* ============================================================
     RESOURCES
  ============================================================ */
  resources: {
    _key: 'drcc_resources',

    getAll()        { return AppStorage.get(this._key, []); },
    getById(id)     { return this.getAll().find(r => r.id === id) || null; },
    getAvailable()  { return this.getAll().filter(r => r.status === 'tersedia'); },
    getDeployed()   { return this.getAll().filter(r => r.status === 'deployed'); },

    create(data) {
      const all   = this.getAll();
      const idNum = String(all.length + 1).padStart(3, '0');
      const item  = { id:`RES-${idNum}`, ...data, assignedTo:null, createdAt:Date.now(), updatedAt:Date.now() };
      all.unshift(item);
      AppStorage.set(this._key, all);
      State._emit('data:updated', this._key);
      return item;
    },

    update(id, updates) {
      const all = this.getAll();
      const idx = all.findIndex(r => r.id === id);
      if (idx < 0) return null;
      all[idx] = { ...all[idx], ...updates, updatedAt: Date.now() };
      AppStorage.set(this._key, all);
      State._emit('data:updated', this._key);
      return all[idx];
    },

    delete(id) {
      this.unassign(id);
      AppStorage.set(this._key, this.getAll().filter(r => r.id !== id));
      State._emit('data:updated', this._key);
      return true;
    },

    assign(resourceId, incidentId) {
      const prev = this.getById(resourceId)?.assignedTo;
      if (prev) this.unassign(resourceId);

      this.update(resourceId, { assignedTo: incidentId, status: 'deployed' });

      const incs = API.incidents.getAll();
      const idx  = incs.findIndex(i => i.id === incidentId);
      if (idx >= 0) {
        const arr = incs[idx].assignedResources || [];
        if (!arr.includes(resourceId)) arr.push(resourceId);
        incs[idx].assignedResources = arr;
        AppStorage.set(API.incidents._key, incs);
      }
      State.notifications.push('success', 'Sumber Daya Ditugaskan', `${this.getById(resourceId)?.name} → ${incidentId}`);
    },

    unassign(resourceId) {
      const res = this.getById(resourceId);
      if (!res?.assignedTo) return;
      const incId = res.assignedTo;
      this.update(resourceId, { assignedTo: null, status: 'tersedia' });

      const incs = API.incidents.getAll();
      const idx  = incs.findIndex(i => i.id === incId);
      if (idx >= 0) {
        incs[idx].assignedResources = (incs[idx].assignedResources || []).filter(r => r !== resourceId);
        AppStorage.set(API.incidents._key, incs);
      }
    },

    getStats() {
      const all = this.getAll();
      const byType = {};
      all.forEach(r => { byType[r.type] = (byType[r.type] || 0) + 1; });
      return {
        total:       all.length,
        tersedia:    all.filter(r => r.status === 'tersedia').length,
        deployed:    all.filter(r => r.status === 'deployed').length,
        maintenance: all.filter(r => r.status === 'maintenance').length,
        byType,
      };
    },
  },

  /* ============================================================
     GLOBAL STATS (for dashboard)
  ============================================================ */
  globalStats() {
    const incStats = this.incidents.getStats();
    const resStats = this.resources.getStats();
    const aiCount  = AppStorage.get('drcc_ai_history', []).length;
    const sigCount = AppStorage.get('drcc_signals_history', [])?.length || 0;
    return { incidents: incStats, resources: resStats, aiAnalyses: aiCount, signalSets: sigCount };
  },

  /* ============================================================
     DATA INTEGRITY CHECK
  ============================================================ */
  validateIntegrity() {
    const issues = [];
    const incidents = this.incidents.getAll();
    const resources = this.resources.getAll();
    const resIds    = new Set(resources.map(r => r.id));

    // Check for orphan resource references in incidents
    incidents.forEach(inc => {
      (inc.assignedResources || []).forEach(rid => {
        if (!resIds.has(rid)) {
          issues.push({ type:'orphan_resource', incidentId: inc.id, resourceId: rid });
        }
      });
    });

    // Auto-fix orphans
    if (issues.length) {
      const fixed = incidents.map(inc => ({
        ...inc,
        assignedResources: (inc.assignedResources || []).filter(rid => resIds.has(rid)),
      }));
      AppStorage.set(this.incidents._key, fixed);
      console.info(`[API] Fixed ${issues.length} integrity issue(s)`);
    }

    return { ok: issues.length === 0, issues };
  },

  /* ============================================================
     SEARCH (cross-module)
  ============================================================ */
  search(query) {
    const term = (query || '').toLowerCase();
    if (!term) return { incidents: [], resources: [] };
    return {
      incidents: this.incidents.getAll().filter(i =>
        [i.title, i.location, i.province, i.reporter, i.desc].some(v => v?.toLowerCase().includes(term))
      ),
      resources: this.resources.getAll().filter(r =>
        [r.name, r.type, r.location, r.notes].some(v => v?.toLowerCase().includes(term))
      ),
    };
  },
};

window.API = API;
