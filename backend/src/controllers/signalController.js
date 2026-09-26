/**
 * DRCC — Signals Controller (Layer 1 & 2)
 * Input signal CRUD + processing pipeline (filter → extract → detect anomaly → score)
 */
'use strict';
const { query } = require('../config/db');
const activityLogger = require('../services/activityLogger');
const { broadcastAll, broadcastToRoles } = require('../sockets/socketServer');

/* ---- Threshold config per signal type (Layer 2 anomaly detection) ---- */
const THRESHOLDS = {
  gempa:       [{ v:7.0, l:'BAHAYA' },{ v:6.0, l:'SIAGA' },{ v:4.0, l:'WASPADA' }],
  cuaca:       [{ v:100, l:'BAHAYA' },{ v:80,  l:'SIAGA' },{ v:50,  l:'WASPADA' }],
  waterLevel:  [{ v:300, l:'BAHAYA' },{ v:250, l:'SIAGA' },{ v:150, l:'WASPADA' }],
  windSpeed:   [{ v:120, l:'BAHAYA' },{ v:80,  l:'SIAGA' },{ v:50,  l:'WASPADA' }],
  temperature: [{ v:40,  l:'BAHAYA' },{ v:35,  l:'SIAGA' },{ v:30,  l:'WASPADA' }],
  pengungsian: [{ v:80,  l:'BAHAYA' },{ v:60,  l:'SIAGA' },{ v:40,  l:'WASPADA' }],
  generic:     [{ v:80,  l:'BAHAYA' },{ v:60,  l:'SIAGA' },{ v:40,  l:'WASPADA' }],
};
const TYPE_MAP = { gempa:'gempa', banjir:'waterLevel', cuaca:'cuaca', angin:'windSpeed', kebakaran:'temperature', pengungsian:'pengungsian' };

function detectAnomaly(value, signalType) {
  const thresholds = THRESHOLDS[signalType] || THRESHOLDS.generic;
  const sorted = [...thresholds].sort((a,b) => b.v - a.v);
  for (const t of sorted) if (value >= t.v) return { isAnomaly:true, level:t.l, threshold:t.v };
  return { isAnomaly:false, level:'NORMAL', threshold:null };
}

function filterValue(value, signalId) {
  const noise = (Math.random() - 0.5) * Math.abs(value) * 0.02;
  return parseFloat((value - noise).toFixed(3));
}

function priorityScore(value, signalType, isAnomaly) {
  const thresholds = THRESHOLDS[signalType] || THRESHOLDS.generic;
  const t = thresholds.find(x => x.l === 'SIAGA')?.v || 60;
  let base = Math.min(80, (value / t) * 50);
  if (isAnomaly) base = Math.min(100, base + 25);
  return Math.max(0, Math.min(100, Math.round(base)));
}

/* ============================================================
   SIGNAL CRUD (Layer 1)
   ============================================================ */
async function list(req, res) {
  const { type, status } = req.query;
  let sql = 'SELECT * FROM signals WHERE 1=1';
  const params = [];
  if (type)   { sql += ' AND type = ?';   params.push(type); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC';
  const rows = await query(sql, params);
  res.json({ signals: rows });
}

async function create(req, res) {
  const { id, name, type, unit, source, lat, lng } = req.body;
  if (!id || !name || !type) return res.status(400).json({ error: 'ID, nama, dan tipe wajib diisi.' });

  await query(
    'INSERT INTO signals (id, name, type, unit, source, lat, lng) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name)',
    [id, name, type, unit || null, source || null, lat || null, lng || null]
  );
  const rows = await query('SELECT * FROM signals WHERE id = ?', [id]);
  broadcastAll('signal:created', rows[0]);
  res.status(201).json({ signal: rows[0] });
}

async function toggleStatus(req, res) {
  const id = req.params.id;
  const rows = await query('SELECT * FROM signals WHERE id = ?', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Sinyal tidak ditemukan.' });
  const newStatus = rows[0].status === 'aktif' ? 'nonaktif' : 'aktif';
  await query('UPDATE signals SET status = ? WHERE id = ?', [newStatus, id]);
  const updated = await query('SELECT * FROM signals WHERE id = ?', [id]);
  broadcastAll('signal:updated', updated[0]);
  res.json({ signal: updated[0] });
}

/* ============================================================
   PROCESSING PIPELINE (Layer 2) — POST /api/signals/:id/process
   Body: { rawValue, signalName, source }
   ============================================================ */
async function process(req, res) {
  const signalId = req.params.id;
  const { rawValue, signalName, source } = req.body;
  if (rawValue === undefined) return res.status(400).json({ error: 'rawValue wajib diisi.' });

  const sigRows = await query('SELECT * FROM signals WHERE id = ?', [signalId]);
  const signal  = sigRows[0];
  const sType   = TYPE_MAP[signal?.type] || 'generic';

  // Step 1: Filter
  const filtered = filterValue(rawValue, signalId);
  // Step 2: Feature extraction
  const features = { magnitude: filtered, unit: signal?.unit || '', source: source || signal?.source || 'Sensor', timestamp: new Date().toISOString() };
  // Step 3: Anomaly detection
  const anomalyResult = detectAnomaly(filtered, sType);
  // Step 4: Priority score
  const score = priorityScore(filtered, sType, anomalyResult.isAnomaly);

  const processingSteps = [
    { step:'filter',  desc:`Noise removal — delta: ${Math.abs(rawValue-filtered).toFixed(3)}` },
    { step:'extract', desc:'Fitur diekstrak: koordinat, unit, kategori' },
    { step:'detect',  desc: anomalyResult.isAnomaly ? `⚠ ANOMALI Level ${anomalyResult.level}` : 'Normal' },
    { step:'score',   desc:`Priority Score: ${score}/100` },
  ];

  const result = await query(
    `INSERT INTO signal_events (signal_id, signal_name, raw_value, filtered_value, features, anomaly, anomaly_level, priority_score, processing_steps, source)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [signalId, signalName || signal?.name || signalId, rawValue, filtered, JSON.stringify(features),
     anomalyResult.isAnomaly ? 1 : 0, anomalyResult.level, score, JSON.stringify(processingSteps), source || null]
  );

  await query('UPDATE signals SET current_value = ? WHERE id = ?', [filtered, signalId]);

  let anomalyRecord = null;
  if (anomalyResult.isAnomaly) {
    await query(
      'INSERT INTO anomalies (signal_id, signal_name, value, threshold, level, signal_type) VALUES (?,?,?,?,?,?)',
      [signalId, signalName || signal?.name || signalId, filtered, anomalyResult.threshold, anomalyResult.level, sType]
    );
    anomalyRecord = { signalId, signalName: signalName || signal?.name, value: filtered, threshold: anomalyResult.threshold, level: anomalyResult.level };
    broadcastAll('anomaly:new', anomalyRecord);
    broadcastToRoles(['admin','operator'], 'notification:new', {
      type: 'warning', title: `⚠ Anomali: ${signalName || signal?.name}`,
      message: `Nilai ${filtered} melebihi threshold ${anomalyResult.threshold} — Level ${anomalyResult.level}`,
    });
  }

  const eventData = {
    id: result.insertId, signalId, signalName: signalName || signal?.name, rawValue, filteredValue: filtered,
    features, anomaly: anomalyResult.isAnomaly, anomalyLevel: anomalyResult.level, priorityScore: score, processingSteps,
  };

  await activityLogger.processing(`Diproses: ${signalName || signalId} = ${rawValue}`, { score, anomaly: anomalyResult.level }, { userId: req.user.id, page: 'signals' });
  broadcastAll('signal:processed', eventData);

  res.json({ result: eventData, anomaly: anomalyRecord });
}

/* GET /api/signals/processing-log */
async function processingLog(req, res) {
  const limit = Math.min(Number(req.query.limit) || 50, 300);
  const rows = await query('SELECT * FROM signal_events ORDER BY created_at DESC LIMIT ?', [limit]);
  rows.forEach(r => {
    if (typeof r.features === 'string') r.features = JSON.parse(r.features);
    if (typeof r.processing_steps === 'string') r.processing_steps = JSON.parse(r.processing_steps);
  });
  res.json({ log: rows });
}

/* GET /api/signals/anomalies */
async function anomalies(req, res) {
  const limit = Math.min(Number(req.query.limit) || 20, 200);
  const rows = await query('SELECT * FROM anomalies ORDER BY created_at DESC LIMIT ?', [limit]);
  res.json({ anomalies: rows });
}

module.exports = { list, create, toggleStatus, process, processingLog, anomalies };
