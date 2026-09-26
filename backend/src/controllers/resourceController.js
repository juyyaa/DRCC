/**
 * DRCC — Resources Controller
 */
'use strict';
const { query, pool } = require('../config/db');
const { nextId } = require('../utils/idGenerator');
const activityLogger = require('../services/activityLogger');
const { broadcastAll } = require('../sockets/socketServer');

async function list(req, res) {
  const { status, type, search } = req.query;
  let sql = 'SELECT * FROM resources WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (type)   { sql += ' AND type = ?';   params.push(type); }
  if (search) { sql += ' AND (name LIKE ? OR location LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY created_at DESC';
  const rows = await query(sql, params);
  res.json({ resources: rows });
}

async function get(req, res) {
  const rows = await query('SELECT * FROM resources WHERE id = ?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Sumber daya tidak ditemukan.' });
  res.json({ resource: rows[0] });
}

async function stats(req, res) {
  const rows = await query(`
    SELECT COUNT(*) AS total,
      COALESCE(SUM(status='tersedia'),0)    AS tersedia,
      COALESCE(SUM(status='deployed'),0)    AS deployed,
      COALESCE(SUM(status='maintenance'),0) AS maintenance
    FROM resources
  `);
  const byType = await query('SELECT type, COUNT(*) AS count FROM resources GROUP BY type');
  res.json({ stats: rows[0], byType });
}

async function create(req, res) {
  const { name, type, quantity, location, notes, status } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Nama dan jenis wajib diisi.' });

  const id = await nextId('resources', 'RES');
  await query(
    'INSERT INTO resources (id, name, type, quantity, status, location, notes, created_by) VALUES (?,?,?,?,?,?,?,?)',
    [id, name, type, quantity || 1, status || 'tersedia', location || null, notes || null, req.user.id]
  );

  const rows = await query('SELECT * FROM resources WHERE id = ?', [id]);
  await activityLogger.action('RESOURCE_CREATED', { id, name, type }, { userId: req.user.id, page: 'resources' });
  broadcastAll('resource:created', rows[0]);
  res.status(201).json({ resource: rows[0] });
}

async function update(req, res) {
  const id = req.params.id;
  const existing = await query('SELECT * FROM resources WHERE id = ?', [id]);
  if (!existing[0]) return res.status(404).json({ error: 'Sumber daya tidak ditemukan.' });

  const allowed = ['name','type','quantity','status','location','notes'];
  const fields = [], params = [];
  for (const [key, val] of Object.entries(req.body)) {
    if (allowed.includes(key) && val !== undefined) { fields.push(`${key} = ?`); params.push(val); }
  }
  if (fields.length) await query(`UPDATE resources SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);

  const rows = await query('SELECT * FROM resources WHERE id = ?', [id]);
  await activityLogger.action('RESOURCE_UPDATED', { id }, { userId: req.user.id, page: 'resources' });
  broadcastAll('resource:updated', rows[0]);
  res.json({ resource: rows[0] });
}

async function remove(req, res) {
  const result = await query('DELETE FROM resources WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Sumber daya tidak ditemukan.' });
  await activityLogger.action('RESOURCE_DELETED', { id: req.params.id }, { userId: req.user.id, page: 'resources' });
  broadcastAll('resource:deleted', { id: req.params.id });
  res.json({ ok: true });
}

/* POST /api/resources/:id/assign  { incidentId } */
async function assign(req, res) {
  const id = req.params.id;
  const { incidentId } = req.body;
  if (!incidentId) return res.status(400).json({ error: 'incidentId wajib diisi.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [resRows] = await conn.execute('SELECT * FROM resources WHERE id = ? FOR UPDATE', [id]);
    if (!resRows[0]) { await conn.rollback(); return res.status(404).json({ error: 'Sumber daya tidak ditemukan.' }); }

    const [incRows] = await conn.execute('SELECT id FROM incidents WHERE id = ?', [incidentId]);
    if (!incRows[0]) { await conn.rollback(); return res.status(404).json({ error: 'Insiden tidak ditemukan.' }); }

    await conn.execute('UPDATE resources SET assigned_to = ?, status = "deployed" WHERE id = ?', [incidentId, id]);
    await conn.commit();
  } catch (err) {
    await conn.rollback(); throw err;
  } finally {
    conn.release();
  }

  const rows = await query('SELECT * FROM resources WHERE id = ?', [id]);
  await activityLogger.action('RESOURCE_ASSIGNED', { id, incidentId }, { userId: req.user.id, page: 'resources' });
  broadcastAll('resource:updated', rows[0]);
  res.json({ resource: rows[0] });
}

/* POST /api/resources/:id/unassign */
async function unassign(req, res) {
  const id = req.params.id;
  await query('UPDATE resources SET assigned_to = NULL, status = "tersedia" WHERE id = ?', [id]);
  const rows = await query('SELECT * FROM resources WHERE id = ?', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Sumber daya tidak ditemukan.' });
  await activityLogger.action('RESOURCE_UNASSIGNED', { id }, { userId: req.user.id, page: 'resources' });
  broadcastAll('resource:updated', rows[0]);
  res.json({ resource: rows[0] });
}

module.exports = { list, get, stats, create, update, remove, assign, unassign };
