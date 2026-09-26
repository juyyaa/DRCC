/**
 * DRCC — AI Command Controller (Layer 3 & 4)
 * Memanggil Gemini service, simpan hasil ke DB, broadcast real-time
 */
'use strict';
const { query } = require('../config/db');
const geminiService = require('../services/geminiService');
const activityLogger = require('../services/activityLogger');
const { broadcastAll, broadcastToRoles } = require('../sockets/socketServer');

/* ---- Decision Tree rules (Layer 4 auto-trigger) ---- */
const RULES = [
  { id:'R01', test: d => d.magnitude >= 7.0, action:'DARURAT NASIONAL — Eskalasi otomatis semua layer', level:'BAHAYA' },
  { id:'R02', test: d => d.magnitude >= 6.0, action:'Aktifkan respons darurat daerah', level:'BAHAYA' },
  { id:'R03', test: d => d.riskScore >= 90,  action:'Auto-escalation: notifikasi semua pejabat darurat', level:'BAHAYA' },
  { id:'R04', test: d => d.riskScore >= 80,  action:'Auto-escalation: aktifkan posko koordinasi', level:'SIAGA' },
  { id:'R05', test: d => d.population > 100000, action:'Populasi besar — koordinasi multi-instansi', level:'SIAGA' },
  { id:'R06', test: d => true,               action:'Monitoring rutin — update laporan situasi', level:'NORMAL' },
];

function evaluateDecisionTree(data) {
  const fired = [];
  for (const rule of RULES) {
    if (rule.test(data)) {
      fired.push({ id: rule.id, action: rule.action, level: rule.level });
      if (rule.level === 'BAHAYA' || rule.level === 'SIAGA') break;
    }
  }
  return { firedRules: fired, topRule: fired[0] || null, allRules: RULES.map(r => ({ id:r.id, action:r.action, level:r.level })) };
}

/* POST /api/ai/analyze
   Body: { type, magnitude, location, province, population, days, scenarioId? }
*/
async function analyze(req, res) {
  const input = req.body;
  if (!input.type || input.magnitude === undefined || !input.location || !input.population) {
    return res.status(400).json({ error: 'type, magnitude, location, dan population wajib diisi.' });
  }

  // 1. Run Gemini multi-agent analysis (Layer 3)
  const { reasoning, risk, avgConfidence } = await geminiService.runFullAnalysis(input);

  // 2. Decision tree evaluation (Layer 4)
  const decisionData = { ...input, riskScore: risk.score };
  const decision = evaluateDecisionTree(decisionData);

  // 3. Area & casualty estimates (deterministic formula, not AI — explainable)
  const areaKm2 = Math.round(Math.pow(10, 0.78 * (input.magnitude || 1) - 2.3) * 75) || 50;
  const casLight  = Math.round(input.population * 0.018 * ((input.magnitude || 1) / 5));
  const casSevere  = Math.round(input.population * 0.005);

  // 4. Persist ai_analyses
  const result = await query(
    `INSERT INTO ai_analyses (user_id, input_data, risk_score, risk_level, area_data, casualty_data, confidence_data, decisions, scenario_id, ai_provider)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      req.user.id, JSON.stringify(input), risk.score, risk.level,
      JSON.stringify({ km2: areaKm2, ha: areaKm2*100, radius: Math.sqrt(areaKm2/3.14).toFixed(1) }),
      JSON.stringify({ light: casLight, severe: casSevere }),
      JSON.stringify(Object.fromEntries(reasoning.map(r => [r.agentId, r.confidence]))),
      JSON.stringify(decision.firedRules.map(r => r.action)),
      input.scenarioId || null, 'gemini',
    ]
  );
  const analysisId = result.insertId;

  // 5. Persist reasoning logs per agent
  for (const r of reasoning) {
    await query(
      'INSERT INTO ai_reasoning_logs (analysis_id, agent_id, agent_name, full_name, steps, confidence, conclusion) VALUES (?,?,?,?,?,?,?)',
      [analysisId, r.agentId, r.agentName, r.fullName, JSON.stringify(r.steps), r.confidence, r.conclusion]
    );
  }

  // 6. Persist multi-agent coordination summary
  const coordMessages = [
    { from:'ARIA', to:'LOGI',  msg:'Estimasi populasi & area terdampak dikirim untuk kalkulasi logistik' },
    { from:'ARIA', to:'RECON', msg:'Severity level dikirim untuk perencanaan evakuasi' },
    { from:'LOGI', to:'RECON', msg:'Ketersediaan transportasi dikirim untuk optimasi rute' },
    { from:'RECON',to:'PULSE', msg:'Rute evakuasi & lokasi posko dikirim untuk notifikasi publik' },
  ];
  const consensus = { riskLevel: risk.level, riskScore: risk.score, statement: `Seluruh agen sepakat: ${risk.level === 'BAHAYA' ? 'eskalasi darurat penuh diperlukan' : risk.level === 'SIAGA' ? 'respons cepat terkoordinasi diperlukan' : 'pemantauan berkelanjutan'}` };
  await query('INSERT INTO agent_coordination (analysis_id, messages, consensus) VALUES (?,?,?)', [analysisId, JSON.stringify(coordMessages), JSON.stringify(consensus)]);

  // 7. Persist decision tree result
  await query(
    'INSERT INTO ai_decisions (analysis_id, input_data, fired_rules, top_rule, all_rules) VALUES (?,?,?,?,?)',
    [analysisId, JSON.stringify(decisionData), JSON.stringify(decision.firedRules), JSON.stringify(decision.topRule), JSON.stringify(decision.allRules)]
  );

  await activityLogger.ai(`AI Analysis: ${input.location} — Risk ${risk.score}`, { risk }, { userId: req.user.id, page: 'ai-command' });
  await activityLogger.decision(`Decision: ${decision.topRule?.level} — ${decision.topRule?.id}`, decision, { userId: req.user.id, page: 'ai-command' });

  // 8. Real-time broadcast
  broadcastToRoles(['admin','operator'], 'ai:analysis:complete', { analysisId, risk, location: input.location });
  if (risk.level === 'BAHAYA') {
    broadcastAll('notification:new', { type:'error', title:'🚨 Auto-Escalation', message: decision.topRule?.action || `Risk ${risk.score}/100 — BAHAYA` });
  }

  res.status(201).json({
    analysisId, input, risk, area: { km2: areaKm2, ha: areaKm2*100 },
    casualties: { light: casLight, severe: casSevere },
    reasoning, decision, avgConfidence,
    geminiConfigured: geminiService.isConfigured(),
  });
}

/* GET /api/ai/history */
async function history(req, res) {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const rows = await query('SELECT * FROM ai_analyses ORDER BY created_at DESC LIMIT ?', [limit]);
  rows.forEach(r => {
    ['input_data','area_data','casualty_data','confidence_data','decisions'].forEach(f => {
      if (typeof r[f] === 'string') { try { r[f] = JSON.parse(r[f]); } catch {} }
    });
  });
  res.json({ history: rows });
}

/* GET /api/ai/analysis/:id — full detail with reasoning + coordination + decision */
async function getAnalysis(req, res) {
  const id = req.params.id;
  const [analysis] = await query('SELECT * FROM ai_analyses WHERE id = ?', [id]);
  if (!analysis) return res.status(404).json({ error: 'Analisis tidak ditemukan.' });

  const reasoning    = await query('SELECT * FROM ai_reasoning_logs WHERE analysis_id = ?', [id]);
  const coordination = await query('SELECT * FROM agent_coordination WHERE analysis_id = ?', [id]);
  const decisions     = await query('SELECT * FROM ai_decisions WHERE analysis_id = ?', [id]);

  reasoning.forEach(r => { if (typeof r.steps === 'string') r.steps = JSON.parse(r.steps); });
  coordination.forEach(c => { ['messages','consensus'].forEach(f => { if (typeof c[f]==='string') c[f]=JSON.parse(c[f]); }); });
  decisions.forEach(d => { ['input_data','fired_rules','top_rule','all_rules'].forEach(f => { if (typeof d[f]==='string') d[f]=JSON.parse(d[f]); }); });

  res.json({ analysis, reasoning, coordination: coordination[0] || null, decision: decisions[0] || null });
}

module.exports = { analyze, history, getAnalysis };
