/**
 * DRCC — History Controller
 * Agregasi riwayat dari incidents, ai_analyses, map_markers, resources, signal_events
 */
'use strict';
const { query } = require('../config/db');

/* GET /api/history — aggregated, filterable, paginated */
async function list(req, res) {
  const { type, level, search, dateFrom, dateTo, page = 1, perPage = 10 } = req.query;

  const sources = [];

  const incidents = await query('SELECT id, title, type, severity, location, province, status, affected_population, created_at FROM incidents ORDER BY created_at DESC LIMIT 200');
  incidents.forEach(i => sources.push({
    ts: i.created_at, type: 'insiden', level: i.severity, title: i.title,
    source: `${i.location}, ${i.province}`, detail: `${i.type} · Status: ${i.status} · ${i.affected_population} terdampak`, refId: i.id,
  }));

  const aiRows = await query('SELECT id, input_data, risk_score, risk_level, created_at FROM ai_analyses ORDER BY created_at DESC LIMIT 200');
  aiRows.forEach(a => {
    let input = {}; try { input = JSON.parse(a.input_data); } catch {}
    sources.push({
      ts: a.created_at, type: 'ai', level: a.risk_level, title: `Analisis AI: ${input.location || '—'}`,
      source: 'AI Command Panel', detail: `${input.type || ''} · Risk Score ${a.risk_score}/100`, refId: String(a.id),
    });
  });

  const markers = await query('SELECT id, name, type, severity, created_at FROM map_markers ORDER BY created_at DESC LIMIT 200');
  markers.forEach(m => sources.push({
    ts: m.created_at, type: 'peta', level: m.severity || 'NORMAL', title: `Marker: ${m.name}`,
    source: 'Situation Map', detail: `Tipe: ${m.type}`, refId: m.id,
  }));

  const resources = await query('SELECT id, name, type, status, assigned_to, updated_at FROM resources WHERE assigned_to IS NOT NULL ORDER BY updated_at DESC LIMIT 200');
  resources.forEach(r => sources.push({
    ts: r.updated_at, type: 'sumberdaya', level: 'INFO', title: `Penugasan: ${r.name}`,
    source: 'Manajemen Sumber Daya', detail: `${r.type} · Status: ${r.status} · → ${r.assigned_to}`, refId: r.id,
  }));

  let filtered = sources;
  if (type)  filtered = filtered.filter(h => h.type === type);
  if (level) filtered = filtered.filter(h => h.level === level);
  if (search) {
    const t = search.toLowerCase();
    filtered = filtered.filter(h => [h.title, h.source, h.detail].some(s => (s||'').toLowerCase().includes(t)));
  }
  if (dateFrom) filtered = filtered.filter(h => new Date(h.ts) >= new Date(dateFrom));
  if (dateTo)   filtered = filtered.filter(h => new Date(h.ts) <= new Date(dateTo + 'T23:59:59'));

  filtered.sort((a,b) => new Date(b.ts) - new Date(a.ts));

  const total = filtered.length;
  const perPageNum = Math.min(Number(perPage) || 10, 100);
  const pageNum = Math.max(Number(page) || 1, 1);
  const start = (pageNum - 1) * perPageNum;
  const items = filtered.slice(start, start + perPageNum);

  res.json({ items, total, page: pageNum, perPage: perPageNum, totalPages: Math.ceil(total / perPageNum) });
}

/* GET /api/history/stats */
async function stats(req, res) {
  const [incCount] = await query('SELECT COUNT(*) AS c FROM incidents');
  const [aiCount]   = await query('SELECT COUNT(*) AS c FROM ai_analyses');
  const [mrkCount]  = await query('SELECT COUNT(*) AS c FROM map_markers');
  const [bahCount]  = await query(`SELECT COUNT(*) AS c FROM incidents WHERE severity='BAHAYA'`);
  res.json({ total: incCount.c + aiCount.c + mrkCount.c, insiden: incCount.c, ai: aiCount.c, peta: mrkCount.c, bahaya: bahCount.c });
}

module.exports = { list, stats };
