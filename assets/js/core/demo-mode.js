/* ============================================
   DRCC — demo-mode.js
   Demo Mode Controller — jalankan 10 skenario end-to-end
   ============================================ */
'use strict';

const DemoMode = {
  RUNS_KEY: 'drcc_scenarios_run',
  _running: false,

  async runScenario(scenarioId, onStep = null) {
    if (this._running) return null;
    const scn = DEMO_SCENARIOS.find(s => s.id === scenarioId);
    if (!scn) { console.warn('[DemoMode] Scenario not found:', scenarioId); return null; }

    this._running = true;
    const run = { id:`RUN-${Date.now()}`, scenarioId, scenario:scn, ts:Date.now(), steps:[], complete:false };

    const _step = (layer, desc, extra={}) => {
      const s = { step:run.steps.length+1, layer, desc, ts:Date.now(), ...extra };
      run.steps.push(s);
      if (onStep) onStep({ ...run, currentStep:s });
      if (window.Logger) Logger.log(`[Demo L${layer}] ${desc}`, extra, layer);
    };

    try {
      /* ── LAYER 1: Input Signal ─────────────────────── */
      _step(1, `Sinyal diterima: ${scn.name} di ${scn.location}`, { signals: scn.signals });
      await this._delay(350);

      /* Process each signal through Layer 2 */
      const procResults = [];
      for (const [sigId, value] of Object.entries(scn.signals)) {
        const sigName = this._sigName(sigId);
        if (window.SignalProcessing) {
          const pr = SignalProcessing.process(sigId, sigName, value, this._sigUnit(sigId), scn.location);
          procResults.push(pr);
        }
        if (window.EvidenceCollector) EvidenceCollector.collect('signal', { scenarioId, sigId, value }, 1);
      }

      /* ── LAYER 2: Signal Processing ───────────────── */
      const anomCount = procResults.filter(p => p.anomaly).length;
      _step(2, `Processing: ${procResults.length} sinyal diproses, ${anomCount} anomali terdeteksi`, { procCount: procResults.length, anomalyCount: anomCount, steps: scn.processingSteps });
      await this._delay(500);
      if (window.EvidenceCollector) EvidenceCollector.collect('processing', { scenarioId, steps: scn.processingSteps, anomalyCount: anomCount }, 2);

      /* ── LAYER 3: AI Agent Reasoning ──────────────── */
      const aiInput = { type: scn.disasterType, magnitude: scn.magnitude, population: scn.population, location: scn.location, province: scn.province, severity: scn.severity, risk: scn.expectedRisk };
      const reasoning = [];
      if (window.ReasoningEngine) {
        for (const id of ['aria','logi','recon','pulse']) {
          reasoning.push(ReasoningEngine.generate(id, aiInput));
          await this._delay(80);
        }
      }
      const coordination = window.MultiAgent ? MultiAgent.coordinate(aiInput) : null;
      _step(3, `AI: 4 agen aktif, ${reasoning.length} reasoning log, koordinasi ${coordination?.messages?.length||0} pesan`, { agentCount:4, coordination: coordination?.id });
      await this._delay(500);
      if (window.EvidenceCollector) EvidenceCollector.collect('ai', { scenarioId, reasoningCount: reasoning.length }, 3);

      /* ── LAYER 4: Prediction & Decision ───────────── */
      const decInput = { ...aiInput, riskScore: scn.expectedRisk.score, anomalyCount: anomCount };
      const decision = window.DecisionTree ? DecisionTree.evaluate(decInput) : null;

      /* Save AI analysis to history */
      const areaKm = Math.round(Math.pow(10, 0.78*scn.magnitude-2.3)*75) || 50;
      const analysis = {
        id: Date.now(), scenarioId,
        input: { ...aiInput, days:7 },
        risk:  scn.expectedRisk,
        area:  { km2:areaKm, ha:areaKm*100, radius:Math.sqrt(areaKm/3.14).toFixed(1) },
        cas:   { light:Math.round(scn.population*0.018*(scn.magnitude/5)), severe:Math.round(scn.population*0.005), missing:Math.round(scn.population*0.001), dead:0 },
        confs: { aria:91, logi:87, recon:84, pulse:89 },
        decisions: scn.aiDecisions,
        ts: Date.now(),
      };
      const aiHist = JSON.parse(localStorage.getItem('drcc_ai_history')||'[]');
      aiHist.unshift(analysis); if (aiHist.length>200) aiHist.splice(200);
      localStorage.setItem('drcc_ai_history', JSON.stringify(aiHist));

      _step(4, `Prediksi: Risk ${scn.expectedRisk.score}/100 — ${scn.expectedRisk.level}, rule ${decision?.topRule?.id||'R10'} terpicu`, { riskScore: scn.expectedRisk.score, riskLevel: scn.expectedRisk.level, decisionId: decision?.id });
      await this._delay(450);
      if (window.EvidenceCollector) EvidenceCollector.collect('prediction', { scenarioId, risk:scn.expectedRisk, decision:decision?.id }, 4);

      /* ── LAYER 5: User Action — Create Incident ───── */
      const incId = `INC-SCN-${scn.no.toString().padStart(3,'0')}`;
      const incidents = JSON.parse(localStorage.getItem('drcc_incidents')||'[]');
      if (!incidents.find(i => i.id === incId)) {
        incidents.unshift({
          id: incId,
          title: scn.incidentData.title, type: scn.incidentData.type,
          location: scn.location, province: scn.province,
          lat: scn.lat, lng: scn.lng,
          severity: scn.severity, status: 'aktif',
          desc: scn.description, reporter: 'Demo Scenario',
          phone: '—', affected: scn.population,
          assignedResources: [], signalOrigin: scn.id,
          createdAt: Date.now(), updatedAt: Date.now(),
        });
        localStorage.setItem('drcc_incidents', JSON.stringify(incidents));
      }
      if (window.State) State.notifications.push('warning', `Demo: ${scn.name}`, `${scn.expectedRisk.level} — ${scn.location}`);
      _step(5, `Insiden dibuat: ${scn.incidentData.title}, notifikasi dikirim ke semua pengguna`, { incidentId: incId });
      if (window.EvidenceCollector) EvidenceCollector.collect('incident', { scenarioId, incidentId: incId }, 5);

      /* ── COMPLETE ─────────────────────────────────── */
      run.complete = true; run.completedAt = Date.now();
      const runs = JSON.parse(localStorage.getItem(this.RUNS_KEY)||'[]');
      runs.unshift(run); if (runs.length>100) runs.splice(100);
      localStorage.setItem(this.RUNS_KEY, JSON.stringify(runs));
      if (window.State) State._emit('demo:complete', run);
      if (onStep) onStep({ ...run, done:true });

    } finally { this._running = false; }
    return run;
  },

  async runAll(onStep=null, onEach=null) {
    for (const scn of DEMO_SCENARIOS) {
      if (onEach) onEach(scn);
      await this.runScenario(scn.id, onStep);
      await this._delay(200);
    }
    if (window.Toast) Toast.success('Demo Selesai!', 'Semua 10 skenario berhasil dijalankan');
  },

  isComplete(scenarioId) {
    return JSON.parse(localStorage.getItem(this.RUNS_KEY)||'[]').some(r => r.scenarioId===scenarioId && r.complete);
  },

  getCompletedCount() {
    const runs = JSON.parse(localStorage.getItem(this.RUNS_KEY)||'[]');
    return new Set(runs.filter(r=>r.complete).map(r=>r.scenarioId)).size;
  },

  getRuns()   { return JSON.parse(localStorage.getItem(this.RUNS_KEY)||'[]'); },
  clearRuns() { localStorage.setItem(this.RUNS_KEY,'[]'); },

  /* helpers */
  _delay(ms)      { return new Promise(r => setTimeout(r, ms)); },
  _sigName(id)    { return ({SIG_001:'Seismograf',SIG_002:'Muka Air',SIG_003:'Cuaca/Hujan',SIG_004:'Kecepatan Angin',SIG_005:'Relawan',SIG_006:'Kapasitas Pengungsian',SIG_007:'Suhu'})[id.replace('-','_')] || id; },
  _sigUnit(id)    { return ({SIG_001:'SR',SIG_002:'cm',SIG_003:'mm/h',SIG_004:'km/h',SIG_005:'orang',SIG_006:'%',SIG_007:'°C'})[id.replace('-','_')] || ''; },
};

window.DemoMode = DemoMode;
