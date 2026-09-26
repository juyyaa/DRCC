/**
 * DRCC — User Management Controller (admin only)
 */
'use strict';
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const activityLogger = require('../services/activityLogger');
const { broadcastToRoles } = require('../sockets/socketServer');

const SAFE_FIELDS = 'id, username, role, name, email, phone, province, status, last_login_at, created_at';

/* GET /api/users */
async function list(req, res) {
  const { role, status, search } = req.query;
  let sql = `SELECT ${SAFE_FIELDS} FROM users WHERE 1=1`;
  const params = [];
  if (role)   { sql += ' AND role = ?';   params.push(role); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (search) { sql += ' AND (username LIKE ? OR name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY created_at DESC';
  const rows = await query(sql, params);
  res.json({ users: rows });
}

/* GET /api/users/:id */
async function get(req, res) {
  const rows = await query(`SELECT ${SAFE_FIELDS} FROM users WHERE id = ?`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'User tidak ditemukan.' });
  res.json({ user: rows[0] });
}

/* POST /api/users */
async function create(req, res) {
  const { username, password, role, name, email, phone, province } = req.body;
  if (!username || !password || !role || !name) {
    return res.status(400).json({ error: 'Username, password, role, dan nama wajib diisi.' });
  }
  if (!['admin','operator','relawan','pemda'].includes(role)) {
    return res.status(400).json({ error: 'Role tidak valid.' });
  }
  const exists = await query('SELECT id FROM users WHERE username = ?', [username]);
  if (exists.length) return res.status(409).json({ error: 'Username sudah digunakan.' });

  const hash = await bcrypt.hash(password, 10);
  const result = await query(
    'INSERT INTO users (username, password_hash, role, name, email, phone, province) VALUES (?,?,?,?,?,?,?)',
    [username, hash, role, name, email || null, phone || null, province || null]
  );
  const newId = result.insertId;

  await activityLogger.action('USER_CREATED', { username, role, by: req.user.username }, { userId: req.user.id, page: 'user-management' });
  broadcastToRoles(['admin'], 'user:created', { id: newId, username, role, name });

  const rows = await query(`SELECT ${SAFE_FIELDS} FROM users WHERE id = ?`, [newId]);
  res.status(201).json({ user: rows[0] });
}

/* PUT /api/users/:id */
async function update(req, res) {
  const { name, email, phone, province, role, status, password } = req.body;
  const id = req.params.id;

  const existing = await query('SELECT id FROM users WHERE id = ?', [id]);
  if (!existing[0]) return res.status(404).json({ error: 'User tidak ditemukan.' });

  const fields = [], params = [];
  if (name      !== undefined) { fields.push('name = ?');      params.push(name); }
  if (email     !== undefined) { fields.push('email = ?');     params.push(email); }
  if (phone     !== undefined) { fields.push('phone = ?');     params.push(phone); }
  if (province  !== undefined) { fields.push('province = ?');  params.push(province); }
  if (role      !== undefined) { fields.push('role = ?');      params.push(role); }
  if (status    !== undefined) { fields.push('status = ?');    params.push(status); }
  if (password)                 { fields.push('password_hash = ?'); params.push(await bcrypt.hash(password, 10)); }

  if (fields.length) {
    await query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
  }

  await activityLogger.action('USER_UPDATED', { targetId: id, by: req.user.username }, { userId: req.user.id, page: 'user-management' });
  broadcastToRoles(['admin'], 'user:updated', { id });

  const rows = await query(`SELECT ${SAFE_FIELDS} FROM users WHERE id = ?`, [id]);
  res.json({ user: rows[0] });
}

/* DELETE /api/users/:id */
async function remove(req, res) {
  const id = req.params.id;
  if (Number(id) === req.user.id) return res.status(400).json({ error: 'Tidak bisa menghapus akun sendiri.' });

  const result = await query('DELETE FROM users WHERE id = ?', [id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'User tidak ditemukan.' });

  await activityLogger.action('USER_DELETED', { targetId: id, by: req.user.username }, { userId: req.user.id, page: 'user-management' });
  broadcastToRoles(['admin'], 'user:deleted', { id });
  res.json({ ok: true });
}

module.exports = { list, get, create, update, remove };
