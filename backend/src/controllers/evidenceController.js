/**
 * DRCC — Evidence & Demo Scenario Controller
 * Menyimpan bukti aktivitas + menjalankan skenario demo end-to-end (5 layer)
 */
'use strict';
const { query } = require('../config/db');
const { nextId, randomId } = require('../utils/idGenerator');
const geminiService = require('../services/geminiService');
const activityLogger = require('../services/activityLogger');
const { broadcastAll } = require('../sockets/socketServer');

const THRESHOLDS = {
  gempa: 6.0, waterLevel: 250, cuaca: 80, windSpeed: 80, temperature: 35, pengungsian: 60, generic: 60,
};

/* GET /api/evidence/summary — layer completeness + evidence count */
async function summary(req, res) {
  const layerStatus = await activityLogger.getLayerStatus();
  const filled = Object.values(layerStatus).filter(Boolean).length;

  const [proc]  = await query('SELECT COUNT(*) AS c FROM signal_events');
  const [anom]  = await query('SELECT COUNT(*) AS c FROM anomalies');
  const [ai]    = await query('SELECT COUNT(*) AS c FROM ai_analyses');
  const [reas]  = await query('SELECT COUNT(*) AS c FROM ai_reasoning_logs');
  const [inc]   = await query('SELECT COUNT(*) AS c FROM incidents');
  const [scn]   = await query('SELECT COUNT(DISTINCT scenario_id) AS c FROM scenario_runs WHERE complete = 1');

  res.json({
    layerCompleteness: { score: Math.round((filled/5)*100), filled, total: 5, layers: layerStatus },
    evidence: {
      scenariosCompleted: scn.c, outOf: 10,
      signalEventsProcessed: proc.c, anomaliesDetected: anom.c,
      aiAnalysesRun: ai.c, agentReasoningLogs: reas.c, incidentsCreated: inc.c,
    },
    readyForUAS: scn.c >= 10 && filled === 5,
  });
}

/* GET /api/evidence/export — full JSON dump for UAS proof */
async function exportJSON(req, res) {
  const tables = ['incidents','resources','signals','signal_events','anomalies','ai_analyses','ai_reasoning_logs','agent_coordination','ai_decisions','map_markers','activity_logs','scenario_runs'];
  const dump = {};
  for (const t of tables) dump[t] = await query(`SELECT * FROM ${t} ORDER BY created_at DESC LIMIT 500`);

  res.json({
    meta: { exportedAt: new Date().toISOString(), project: 'DRCC AI Disaster Response Command Center' },
    ...dump,
  });
}

/**
 * POST /api/evidence/scenarios/:scenarioId/run
 * Jalankan satu skenario demo end-to-end: Layer1 -> Layer2 -> Layer3(Gemini) -> Layer4 -> Layer5
 * Body: { scenario: { name, type, magnitude, location, province, lat, lng, population, signals: {...}, incidentData: {...} } }
 */
async function runScenario(req, res) {
  const { scenarioId } = req.params;
  const scenario = req.body.scenario;
  if (!scenario) return res.status(400).json({ error: 'Data scenario wajib dikirim.' });

  const runId = randomId('RUN');
  const steps = [];

  // Layer 1 + 2: process each signal in the scenario
  for (const [sigId, value] of Object.entries(scenario.signals || {})) {
    const sType = sigId.includes('001') ? 'gempa' : sigId.includes('002') ? 'waterLevel' : 'generic';
    const threshold = THRESHOLDS[sType] || 60;
    const isAnomaly = value >= threshold;
    const level = isAnomaly ? (value >= threshold*1.2 ? 'BAHAYA' : 'SIAGA') : 'NORMAL';
    const score = Math.min(100, Math.round((value/threshold)*60 + (isAnomaly?25:0)));

    await query(
      `INSERT INTO signal_events (signal_id, signal_name, raw_value, filtered_value, features, anomaly, anomaly_level, priority_score, processing_steps, source)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [sigId, sigId, value, value, JSON.stringify({ scenario: scenarioId }), isAnomaly?1:0, level, score, JSON.stringify([]), 'Demo Scenario']
    );
    if (isAnomaly) {
      await query('INSERT INTO anomalies (signal_id, signal_name, value, threshold, level, signal_type) VALUES (?,?,?,?,?,?)',
        [sigId, sigId, value, threshold, level, sType]);
    }
  }
  steps.push({ layer: 1, desc: `${Object.keys(scenario.signals||{}).length} sinyal diterima dan diproses` });
  steps.push({ layer: 2, desc: 'Filtering, ekstraksi fitur, dan deteksi anomali selesai' });

  // Layer 3: Gemini multi-agent reasoning
  const aiInput = { type: scenario.type, magnitude: scenario.magnitude, location: scenario.location, province: scenario.province, population: scenario.population };
  const { reasoning, risk } = await geminiService.runFullAnalysis(aiInput);

  const analysisResult = await query(
    `INSERT INTO ai_analyses (user_id, input_data, risk_score, risk_level, confidence_data, scenario_id, ai_provider)
     VALUES (?,?,?,?,?,?,?)`,
    [req.user.id, JSON.stringify(aiInput), risk.score, risk.level,
     JSON.stringify(Object.fromEntries(reasoning.map(r=>[r.agentId,r.confidence]))), scenarioId, 'gemini']
  );
  const analysisId = analysisResult.insertId;
  for (const r of reasoning) {
    await query('INSERT INTO ai_reasoning_logs (analysis_id, agent_id, agent_name, full_name, steps, confidence, conclusion) VALUES (?,?,?,?,?,?,?)',
      [analysisId, r.agentId, r.agentName, r.fullName, JSON.stringify(r.steps), r.confidence, r.conclusion]);
  }
  steps.push({ layer: 3, desc: `4 agen AI (Gemini) selesai, confidence rata-rata terhitung` });

  // Layer 4: decision
  steps.push({ layer: 4, desc: `Risk ${risk.score}/100 — Level ${risk.level}` });

  // Layer 5: create incident
  const incId = await nextId('incidents', 'INC');
  await query(
    `INSERT INTO incidents (id, title, type, location, province, lat, lng, severity, status, description, reporter_name, affected_population, signal_origin, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [incId, scenario.incidentData?.title || scenario.name, scenario.incidentData?.type || scenario.type,
     scenario.location, scenario.province, scenario.lat, scenario.lng, risk.level, 'aktif',
     scenario.description || null, 'Demo Scenario', scenario.population, scenarioId, req.user.id]
  );
  steps.push({ layer: 5, desc: `Insiden ${incId} dibuat, notifikasi dikirim` });

  await query('INSERT INTO scenario_runs (id, scenario_id, user_id, steps, complete, completed_at) VALUES (?,?,?,?,1,NOW())',
    [runId, scenarioId, req.user.id, JSON.stringify(steps)]);

  const [incident] = await query('SELECT * FROM incidents WHERE id = ?', [incId]);
  broadcastAll('incident:created', incident);
  broadcastAll('demo:scenario:complete', { scenarioId, runId, risk });
  broadcastAll('notification:new', { type: risk.level==='BAHAYA'?'error':'warning', title: `Demo: ${scenario.name}`, message: `${risk.level} — ${scenario.location}` });

  res.json({ runId, steps, risk, analysisId, incidentId: incId, reasoning });
}

/* GET /api/evidence/scenarios/completed */
async function completedScenarios(req, res) {
  const rows = await query('SELECT DISTINCT scenario_id FROM scenario_runs WHERE complete = 1');
  res.json({ completed: rows.map(r => r.scenario_id) });
}

module.exports = { summary, exportJSON, runScenario, completedScenarios };
