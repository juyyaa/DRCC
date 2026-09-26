/* ============================================
   DRCC — trace-viewer.js
   End-to-end trace: Signal → Processing → AI → Decision → Action
   ============================================ */
'use strict';

const TraceViewer = {

  /* Build full trace for a scenario ID or incident ID */
  buildTrace(refId) {
    const _get = k => { try { return JSON.parse(localStorage.getItem(k)||'[]'); } catch { return []; } };

    const scnRuns  = _get('drcc_scenarios_run');
    const proc     = _get('drcc_processing_log');
    const anom     = _get('drcc_anomalies');
    const ai       = _get('drcc_ai_history');
    const reas     = _get('drcc_reasoning_log');
    const coord    = _get('drcc_agent_coordination');
    const dec      = _get('drcc_ai_decisions');
    const inc      = _get('drcc_incidents');

    const run = scnRuns.find(r => r.scenarioId === refId || r.id === refId);
    const relInc = inc.find(i => i.signalOrigin === refId || i.id === refId);

    const trace = {
      id:     `TRACE-${Date.now()}`,
      refId,  ts: Date.now(),
      found:  !!(run || relInc),
      layers: [
        {
          layer: 1, name:'Input Signal',
          items: proc.filter(p => p.signalId && (run?.scenario?.signals ? Object.keys(run.scenario.signals).includes(p.signalId) : true)).slice(0,3),
          count: proc.length,
        },
        {
          layer: 2, name:'Signal Processing',
          items: anom.slice(0,3),
          anomalyCount: anom.length,
          count: proc.length,
        },
        {
          layer: 3, name:'AI Agent',
          items: reas.slice(0,4),
          coordination: coord[0] || null,
          count: reas.length,
        },
        {
          layer: 4, name:'Prediction/Decision',
          items: ai.filter(a => a.scenarioId === refId || !a.scenarioId).slice(0,2),
          decisions: dec.slice(0,2),
          count: ai.length,
        },
        {
          layer: 5, name:'User Action',
          items: inc.filter(i => i.signalOrigin === refId || i.id?.includes('SCN')).slice(0,3),
          count: inc.length,
        },
      ],
    };
    return trace;
  },

  /* Render HTML trace view */
  renderHTML(refId) {
    const trace = this.buildTrace(refId);
    const layerColors = { 1:'#2980B9', 2:'#E67E22', 3:'#B5651D', 4:'#8E44AD', 5:'#27AE60' };
    const layerIcons  = { 1:'fa-satellite-dish', 2:'fa-microchip', 3:'fa-brain', 4:'fa-scale-balanced', 5:'fa-user-shield' };

    const layers = trace.layers.map(l => {
      const col = layerColors[l.layer];
      const hasData = l.count > 0 || l.items?.length > 0;
      return `
        <div style="border:1.5px solid ${col}33;border-radius:10px;overflow:hidden;margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:${col}11">
            <i class="fas ${layerIcons[l.layer]}" style="color:${col}"></i>
            <span style="font-weight:800;font-size:13px;color:${col}">Layer ${l.layer}: ${l.name}</span>
            <span style="margin-left:auto;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:${hasData?col:'var(--border)'};color:${hasData?'#fff':'var(--text-muted)'}">${hasData?`${l.count} entri`:'Kosong'}</span>
          </div>
          <div style="padding:10px 14px;font-size:11px;color:var(--text-muted)">
            ${l.items?.length ? l.items.slice(0,2).map(item => `
              <div style="padding:5px 8px;background:var(--bg);border-radius:6px;margin-bottom:4px;border-left:3px solid ${col}">
                ${this._formatItem(item, l.layer)}
              </div>`).join('') : `<span style="color:var(--text-light)">Jalankan demo scenario untuk mengisi layer ini</span>`}
          </div>
        </div>`;
    }).join('');

    return `
      <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:12px">
        Trace ID: ${refId} — ${trace.found ? '✅ Data ditemukan' : '⚠ Jalankan skenario untuk trace lengkap'}
      </div>
      ${layers}`;
  },

  _formatItem(item, layer) {
    if (!item) return '—';
    if (layer === 1 || layer === 2) return `${item.signalName || item.signalId || 'Sinyal'} = ${item.rawValue ?? item.filteredValue ?? item.value ?? '?'} → Score ${item.priorityScore || '?'}`;
    if (layer === 3) return `${item.agentName || item.agentId || 'Agent'} — Confidence ${item.confidence || '?'}%`;
    if (layer === 4) return `Risk ${item.risk?.score || '?'}/100 — Level ${item.risk?.level || '?'}`;
    if (layer === 5) return `Insiden: ${item.title || item.id} — ${item.severity || '?'}`;
    return JSON.stringify(item).slice(0,80);
  },
};

window.TraceViewer = TraceViewer;
