/**
 * DRCC — Map Markers Controller
 * Setiap penambahan/penghapusan titik broadcast real-time ke semua role yang relevan
 */
'use strict';
const { query } = require('../config/db');
const { nextId } = require('../utils/idGenerator');
const activityLogger = require('../services/activityLogger');
const { broadcastAll } = require('../sockets/socketServer');

async function list(req, res) {
  const { type, category } = req.query;
  let sql = 'SELECT * FROM map_markers WHERE 1=1';
  const params = [];
  if (type)     { sql += ' AND type = ?';     params.push(type); }
  if (category) { sql += ' AND category = ?'; params.push(category); }
  sql += ' ORDER BY created_at DESC';
  const rows = await query(sql, params);
  res.json({ markers: rows });
}

async function get(req, res) {
  const rows = await query('SELECT * FROM map_markers WHERE id = ?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Marker tidak ditemukan.' });
  res.json({ marker: rows[0] });
}

async function create(req, res) {
  const { name, type, category, severity, lat, lng, description, markerDate, incidentId } = req.body;
  if (!name || !type || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'Nama, tipe, dan koordinat wajib diisi.' });
  }

  const id = await nextId('map_markers', 'MRK');
  await query(
    `INSERT INTO map_markers (id, name, type, category, severity, lat, lng, description, marker_date, incident_id, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [id, name, type, category || 'disaster', severity || null, lat, lng, description || null, markerDate || null, incidentId || null, req.user.id]
  );

  const rows = await query('SELECT * FROM map_markers WHERE id = ?', [id]);
  const marker = rows[0];

  await activityLogger.action('MARKER_CREATED', { id, name, type }, { userId: req.user.id, page: 'map' });

  // Real-time: broadcast ke SEMUA user yang sedang online, sesuai requirement utama
  broadcastAll('marker:created', marker);

  res.status(201).json({ marker });
}

async function update(req, res) {
  const id = req.params.id;
  const existing = await query('SELECT * FROM map_markers WHERE id = ?', [id]);
  if (!existing[0]) return res.status(404).json({ error: 'Marker tidak ditemukan.' });

  const allowed = ['name','type','category','severity','lat','lng','description','marker_date'];
  const map = { markerDate: 'marker_date' };
  const fields = [], params = [];
  for (const [key, val] of Object.entries(req.body)) {
    const col = map[key] || key;
    if (allowed.includes(col) && val !== undefined) { fields.push(`${col} = ?`); params.push(val); }
  }
  if (fields.length) await query(`UPDATE map_markers SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);

  const rows = await query('SELECT * FROM map_markers WHERE id = ?', [id]);
  await activityLogger.action('MARKER_UPDATED', { id }, { userId: req.user.id, page: 'map' });
  broadcastAll('marker:updated', rows[0]);
  res.json({ marker: rows[0] });
}

async function remove(req, res) {
  const id = req.params.id;
  const result = await query('DELETE FROM map_markers WHERE id = ?', [id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Marker tidak ditemukan.' });

  await activityLogger.action('MARKER_DELETED', { id }, { userId: req.user.id, page: 'map' });
  broadcastAll('marker:deleted', { id });
  res.json({ ok: true });
}

module.exports = { list, get, create, update, remove };
