/**
 * DRCC — Notifications Controller
 */
'use strict';
const { query } = require('../config/db');
const { broadcastAll, broadcastToRoles, sendToUser } = require('../sockets/socketServer');

/* GET /api/notifications — for current user (personal + role-targeted + broadcast) */
async function list(req, res) {
  const rows = await query(
    `SELECT * FROM notifications
     WHERE user_id = ? OR target_role = ? OR target_role = 'all'
     ORDER BY created_at DESC LIMIT 50`,
    [req.user.id, req.user.role]
  );
  res.json({ notifications: rows, unreadCount: rows.filter(n => !n.is_read).length });
}

/* POST /api/notifications/mark-read/:id */
async function markRead(req, res) {
  await query('UPDATE notifications SET is_read = 1 WHERE id = ? AND (user_id = ? OR user_id IS NULL)', [req.params.id, req.user.id]);
  res.json({ ok: true });
}

/* POST /api/notifications/mark-all-read */
async function markAllRead(req, res) {
  await query(
    `UPDATE notifications SET is_read = 1 WHERE user_id = ? OR target_role = ? OR target_role = 'all'`,
    [req.user.id, req.user.role]
  );
  res.json({ ok: true });
}

/* POST /api/notifications — admin/operator can push manual notification */
async function create(req, res) {
  const { targetRole, type, title, message, userId } = req.body;
  if (!title) return res.status(400).json({ error: 'Title wajib diisi.' });

  const result = await query(
    'INSERT INTO notifications (user_id, target_role, type, title, message) VALUES (?,?,?,?,?)',
    [userId || null, targetRole || 'all', type || 'info', title, message || null]
  );

  const payload = { id: result.insertId, type: type || 'info', title, message, ts: Date.now() };
  if (userId) sendToUser(userId, 'notification:new', payload);
  else if (targetRole && targetRole !== 'all') broadcastToRoles([targetRole], 'notification:new', payload);
  else broadcastAll('notification:new', payload);

  res.status(201).json({ ok: true });
}

module.exports = { list, markRead, markAllRead, create };
