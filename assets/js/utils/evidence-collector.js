/* ============================================
   DRCC — evidence-collector.js
   Kumpul & export bukti aktivitas untuk UAS
   ============================================ */
'use strict';

const EvidenceCollector = {
  KEY: 'drcc_evidence',

  collect(type, data, layer = 0) {
    const ev = {
      id:    `EV-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
      ts:    Date.now(),
      type,  layer, data,
      user:  window.Auth?.getSession()?.username || 'system',
      page:  window.location.pathname.match(/pages\/([\w-]+)\.html/)?.[1] || 'root',
    };
    try {
      const all = JSON.parse(localStorage.getItem(this.KEY)||'[]');
      all.unshift(ev);
      if (all.length > 300) all.splice(300);
      localStorage.setItem(this.KEY, JSON.stringify(all));
    } catch {}
    return ev;
  },

  getAll()          { try { return JSON.parse(localStorage.getItem(this.KEY)||'[]'); } catch { return []; } },
  getByType(t)      { return this.getAll().filter(e => e.type === t); },
  getByLayer(l)     { return this.getAll().filter(e => e.layer === l); },

  getSummary() {
    const _get = k => { try { return JSON.parse(localStorage.getItem(k)||'[]'); } catch { return []; } };
    const proc  = _get('drcc_processing_log');
    const anom  = _get('drcc_anomalies');
    const ai    = _get('drcc_ai_history');
    const inc   = _get('drcc_incidents');
    const scn   = _get('drcc_scenarios_run');
    const reas  = _get('drcc_reasoning_log');
    const coord = _get('drcc_agent_coordination');

    const layerStatus = window.Schema ? Schema.getLayerStatus() : {};
    const filled = Object.values(layerStatus).filter(Boolean).length;

    return {
      totalEvidence:      this.getAll().length,
      scenariosRun:       new Set(scn.map(s=>s.scenarioId)).size,
      signalEventsProc:   proc.length,
      anomaliesDetected:  anom.length,
      aiAnalyses:         ai.length,
      reasoningSteps:     reas.length,
      coordSessions:      coord.length,
      incidentsCreated:   inc.length,
      layersFilled:       filled,
      layerCompleteness:  Math.round((filled/5)*100),
      layerStatus,
    };
  },

  getLayerScore() {
    const s = this.getSummary();
    return { score: s.layerCompleteness, layers: s.layerStatus, filled: s.layersFilled };
  },

  /* ---- EXPORTS ---- */
  exportJSON() {
    const _get = k => { try { return JSON.parse(localStorage.getItem(k)||'[]'); } catch { return []; } };
    const blob = new Blob([JSON.stringify({
      meta: { exportedAt: new Date().toISOString(), project:'DRCC AI Disaster Response Command Center', team:'Mahasiswa Teknik Elektro' },
      summary:         this.getSummary(),
      evidence:        this.getAll(),
      processingLog:   _get('drcc_processing_log'),
      anomalies:       _get('drcc_anomalies'),
      aiHistory:       _get('drcc_ai_history'),
      reasoningLog:    _get('drcc_reasoning_log'),
      coordinationLog: _get('drcc_agent_coordination'),
      aiDecisions:     _get('drcc_ai_decisions'),
      activityLog:     _get('drcc_activity_log'),
      incidents:       _get('drcc_incidents'),
      scenariosRun:    _get('drcc_scenarios_run'),
    }, null, 2)], { type:'application/json' });
    const a = Object.assign(document.createElement('a'),{ href:URL.createObjectURL(blob), download:`DRCC_Evidence_UAS_${Date.now()}.json` });
    a.click(); URL.revokeObjectURL(a.href);
    if (window.Toast) Toast.success('Evidence Diekspor', 'Bukti UAS lengkap tersimpan di JSON');
  },

  exportCSV() {
    const all = this.getAll();
    if (!all.length) { if (window.Toast) Toast.warning('Kosong','Belum ada evidence terkumpul'); return; }
    const rows = ['ID,Type,Layer,Timestamp,User,Page,Summary'];
    all.forEach(e => rows.push([
      e.id, e.type, e.layer,
      new Date(e.ts).toLocaleString('id-ID'),
      e.user, e.page,
      `"${JSON.stringify(e.data).replace(/"/g,'""').slice(0,80)}"`,
    ].join(',')));
    const a = Object.assign(document.createElement('a'),{
      href: URL.createObjectURL(new Blob(['\uFEFF'+rows.join('\n')],{type:'text/csv'})),
      download: `DRCC_Evidence_${Date.now()}.csv`,
    });
    a.click();
    if (window.Toast) Toast.success('CSV Diekspor', `${all.length} baris evidence`);
  },

  clear() { localStorage.setItem(this.KEY,'[]'); },
};

window.EvidenceCollector = EvidenceCollector;
