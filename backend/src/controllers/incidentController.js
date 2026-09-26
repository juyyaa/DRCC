/**
 * DRCC — Incidents Controller
 * CRUD insiden bencana + broadcast real-time via WebSocket
 */
'use strict';
const { query, pool } = require('../config/db');
const { nextId } = require('../utils/idGenerator');
const activityLogger = require('../services/activityLogger');
const { broadcastAll, broadcastToRoles } = require('../sockets/socketServer');

/* GET /api/incidents — list with filters */
async function list(req, res) {
  const { status, severity, type, province, search } = req.query;
  let sql = 'SELECT * FROM incidents WHERE 1=1';
  const params = [];
  if (status)   { sql += ' AND status = ?';   params.push(status); }
  if (severity) { sql += ' AND severity = ?'; params.push(severity); }
  if (type)     { sql += ' AND type = ?';     params.push(type); }
  if (province) { sql += ' AND province = ?'; params.push(province); }
  if (search)   { sql += ' AND (title LIKE ? OR location LIKE ? OR description LIKE ?)'; params.push(`%${search}%`,`%${search}%`,`%${search}%`); }

  // Pemda role: scope to their province only (if set)
  if (req.user.role === 'pemda' && req.user.province) {
    sql += ' AND province = ?'; params.push(req.user.province);
  }

  sql += ' ORDER BY created_at DESC';
  const rows = await query(sql, params);

  // Attach assigned resources for each incident
  for (const inc of rows) {
    const res2 = await query('SELECT id, name, type, status FROM resources WHERE assigned_to = ?', [inc.id]);
    inc.assignedResources = res2;
  }

  res.json({ incidents: rows });
}

/* GET /api/incidents/:id */
async function get(req, res) {
  const rows = await query('SELECT * FROM incidents WHERE id = ?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Insiden tidak ditemukan.' });
  const resources = await query('SELECT id, name, type, status FROM resources WHERE assigned_to = ?', [req.params.id]);
  rows[0].assignedResources = resources;
  res.json({ incident: rows[0] });
}

/* GET /api/incidents/stats */
async function stats(req, res) {
  const rows = await query(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(status='aktif'),0)      AS aktif,
      COALESCE(SUM(status='ditangani'),0)  AS ditangani,
      COALESCE(SUM(status='selesai'),0)    AS selesai,
      COALESCE(SUM(severity='BAHAYA'),0)   AS bahaya,
      COALESCE(SUM(severity='SIAGA'),0)    AS siaga,
      COALESCE(SUM(severity='WASPADA'),0)  AS waspada,
      COALESCE(SUM(affected_population),0) AS totalAffected
    FROM incidents
  `);
  res.json({ stats: rows[0] });
}

/* POST /api/incidents */
async function create(req, res) {
  const { title, type, location, province, lat, lng, severity, description, reporterName, reporterPhone, affectedPopulation, signalOrigin } = req.body;
  if (!title || !type || !location || !province || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'Judul, jenis, lokasi, provinsi, dan koordinat wajib diisi.' });
  }

  const id = await nextId('incidents', 'INC');
  await query(
    `INSERT INTO incidents (id, title, type, location, province, lat, lng, severity, status, description, reporter_name, reporter_phone, affected_population, signal_origin, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, title, type, location, province, lat, lng, severity || 'NORMAL', 'aktif', description || null,
     reporterName || req.user.name, reporterPhone || null, affectedPopulation || 0, signalOrigin || null, req.user.id]
  );

  const rows = await query('SELECT * FROM incidents WHERE id = ?', [id]);
  const incident = rows[0];
  incident.assignedResources = [];

  await activityLogger.action('INCIDENT_CREATED', { id, title, severity: incident.severity }, { userId: req.user.id, page: 'incidents' });

  broadcastAll('incident:created', incident);
  if (incident.severity === 'BAHAYA' || incident.severity === 'SIAGA') {
    broadcastAll('notification:new', {
      type: incident.severity === 'BAHAYA' ? 'error' : 'warning',
      title: `Insiden Baru: ${incident.severity}`,
      message: `${incident.title} — ${incident.location}`,
    });
  }

  res.status(201).json({ incident });
}

/* PUT /api/incidents/:id */
async function update(req, res) {
  const id = req.params.id;
  const existing = await query('SELECT * FROM incidents WHERE id = ?', [id]);
  if (!existing[0]) return res.status(404).json({ error: 'Insiden tidak ditemukan.' });

  const allowed = ['title','type','location','province','lat','lng','severity','status','description','reporter_name','reporter_phone','affected_population'];
  const map = { reporterName:'reporter_name', reporterPhone:'reporter_phone', affectedPopulation:'affected_population' };
  const fields = [], params = [];

  for (const [key, val] of Object.entries(req.body)) {
    const col = map[key] || key;
    if (allowed.includes(col) && val !== undefined) { fields.push(`${col} = ?`); params.push(val); }
  }
  if (fields.length) {
    await query(`UPDATE incidents SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
  }

  const rows = await query('SELECT * FROM incidents WHERE id = ?', [id]);
  const incident = rows[0];
  const resources = await query('SELECT id, name, type, status FROM resources WHERE assigned_to = ?', [id]);
  incident.assignedResources = resources;

  await activityLogger.action('INCIDENT_UPDATED', { id, changes: Object.keys(req.body) }, { userId: req.user.id, page: 'incidents' });
  broadcastAll('incident:updated', incident);

  res.json({ incident });
}

/* DELETE /api/incidents/:id */
async function remove(req, res) {
  const id = req.params.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('UPDATE resources SET assigned_to = NULL, status = "tersedia" WHERE assigned_to = ?', [id]);
    const [result] = await conn.execute('DELETE FROM incidents WHERE id = ?', [id]);
    await conn.commit();
    if (!result.affectedRows) return res.status(404).json({ error: 'Insiden tidak ditemukan.' });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  await activityLogger.action('INCIDENT_DELETED', { id }, { userId: req.user.id, page: 'incidents' });
  broadcastAll('incident:deleted', { id });
  res.json({ ok: true });
}

module.exports = { list, get, stats, create, update, remove };
