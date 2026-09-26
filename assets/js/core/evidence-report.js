/* ============================================
   DRCC — evidence-report.js
   Auto-generate laporan bukti UAS + layer completeness score
   ============================================ */
'use strict';

const EvidenceReport = {

  generate() {
    const summary    = window.EvidenceCollector ? EvidenceCollector.getSummary() : {};
    const layerScore = window.Schema ? Schema.getCompletenessScore() : { score:0, layers:{} };
    const _get       = k => { try { return JSON.parse(localStorage.getItem(k)||'[]'); } catch { return []; } };

    const proc  = _get('drcc_processing_log');
    const anom  = _get('drcc_anomalies');
    const ai    = _get('drcc_ai_history');
    const reas  = _get('drcc_reasoning_log');
    const coord = _get('drcc_agent_coordination');
    const dec   = _get('drcc_ai_decisions');
    const inc   = _get('drcc_incidents');
    const scnRuns = _get('drcc_scenarios_run');
    const scenariosDone = new Set(scnRuns.filter(r=>r.complete).map(r=>r.scenarioId)).size;

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        project:     'DRCC — AI Disaster Response Command Center',
        team:        'Mahasiswa Teknik Elektro (3 Orang)',
        rubricTarget: 100,
      },
      score: this._estimateScore(layerScore, { scenariosDone, aiCount:ai.length, anomCount:anom.length, reasoningCount:reas.length }),
      layerCompleteness: { score: layerScore.score, filled: layerScore.filled, total:5, layers: {
        1: { name:'Input Signal',         complete: layerScore.layers[1], dataCount: proc.length,  desc:'Signal events processed' },
        2: { name:'Signal Processing',    complete: layerScore.layers[2], dataCount: anom.length,  desc:'Anomalies detected' },
        3: { name:'AI Agent',             complete: layerScore.layers[3], dataCount: reas.length,  desc:'Reasoning logs + coordination' },
        4: { name:'Prediction/Decision',  complete: layerScore.layers[4], dataCount: ai.length,    desc:'AI analyses + decision trees' },
        5: { name:'User Action',          complete: layerScore.layers[5], dataCount: inc.length,   desc:'Incidents created' },
      }},
      evidence: {
        scenariosCompleted:   scenariosDone,
        outOf:                10,
        signalEventsProcessed:proc.length,
        anomaliesDetected:    anom.length,
        aiAnalysesRun:        ai.length,
        agentReasoningLogs:   reas.length,
        coordinationSessions: coord.length,
        decisionsEvaluated:   dec.length,
        incidentsCreated:     inc.length,
        totalEvidence:        summary.totalEvidence || 0,
      },
      readyForUAS: scenariosDone >= 10 && layerScore.score === 100,
    };
  },

  _estimateScore(layerScore, counts) {
    let s = 70;
    if (layerScore.score === 100) s += 10; else if (layerScore.score >= 80) s += 7;
    if (counts.scenariosDone >= 10) s += 10; else if (counts.scenariosDone >= 5) s += 5;
    if (counts.aiCount       >= 5)  s += 3;
    if (counts.anomCount     >= 3)  s += 3;
    if (counts.reasoningCount>= 4)  s += 2;
    return Math.min(100, s);
  },

  /* Render dashboard summary card HTML */
  renderCard() {
    const r  = this.generate();
    const lc = r.layerCompleteness;
    const ev = r.evidence;
    const pct = lc.score;
    const gauge = (val, total, col) => `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <div style="flex:1;height:4px;background:var(--border);border-radius:2px">
          <div style="width:${Math.min(100,val/total*100)}%;height:4px;background:${col};border-radius:2px"></div>
        </div>
        <span style="font-size:11px;font-weight:700;color:${col};min-width:28px;text-align:right">${val}/${total}</span>
      </div>`;

    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">5 Layer Completeness</div>
          <div style="font-size:36px;font-weight:900;color:${pct===100?'var(--success)':'var(--copper)'}">${pct}%</div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">${lc.filled}/5 layer aktif</div>
          ${Object.values(lc.layers).map(l => `
            <div style="display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:3px">
              <span style="color:${l.complete?'var(--success)':'var(--danger)'}">${l.complete?'✅':'❌'}</span>
              <span style="color:var(--text);flex:1">L${Object.values(lc.layers).indexOf(l)+1}: ${l.name}</span>
              <span style="color:var(--text-muted)">${l.dataCount}</span>
            </div>`).join('')}
        </div>
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">Bukti Terkumpul</div>
          <div style="font-size:32px;font-weight:900;color:var(--copper)">${ev.scenariosCompleted}<span style="font-size:16px;color:var(--text-muted)">/10</span></div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Skenario dijalankan</div>
          ${gauge(ev.aiAnalysesRun, 10, 'var(--copper)')}
          ${gauge(ev.anomaliesDetected, 15, 'var(--danger)')}
          ${gauge(ev.incidentsCreated, 10, 'var(--success)')}
          <div style="margin-top:10px;padding:8px;background:${r.readyForUAS?'rgba(39,174,96,.1)':'rgba(230,126,34,.1)'};border-radius:8px;text-align:center">
            <span style="font-size:12px;font-weight:800;color:${r.readyForUAS?'var(--success)':'var(--warning)'}">
              ${r.readyForUAS ? '✅ SIAP UAS — Skor Estimasi ' + r.score + '/100' : `⚡ Progress — ${ev.scenariosCompleted}/10 skenario`}
            </span>
          </div>
        </div>
      </div>`;
  },

  exportJSON() {
    const r = this.generate();
    const a = Object.assign(document.createElement('a'),{
      href: URL.createObjectURL(new Blob([JSON.stringify(r,null,2)],{type:'application/json'})),
      download: `DRCC_Report_UAS_${Date.now()}.json`,
    });
    a.click();
    if (window.Toast) Toast.success('Report Exported','Laporan bukti UAS berhasil diekspor');
  },

  printView() { window.print(); },
};

window.EvidenceReport = EvidenceReport;
