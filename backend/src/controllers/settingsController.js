/**
 * DRCC — Settings Controller (per-user profile, notif, display preferences)
 */
'use strict';
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

/* GET /api/settings */
async function get(req, res) {
  const userRows = await query('SELECT id, username, name, email, phone, province, role FROM users WHERE id = ?', [req.user.id]);
  const settingRows = await query('SELECT notif, display FROM user_settings WHERE user_id = ?', [req.user.id]);

  const setting = settingRows[0] || {};
  ['notif','display'].forEach(f => {
    if (typeof setting[f] === 'string') { try { setting[f] = JSON.parse(setting[f]); } catch { setting[f] = {}; } }
  });

  res.json({
    profile: userRows[0],
    notif:   setting.notif   || { toastDuration: 4000, soundEnabled: false, alertLevel: 'WASPADA' },
    display: setting.display || { darkMode: false, fontSize: 'medium', language: 'id', timezone: 'Asia/Jakarta' },
  });
}

/* PUT /api/settings/profile */
async function updateProfile(req, res) {
  const { name, email, phone } = req.body;
  const fields = [], params = [];
  if (name  !== undefined) { fields.push('name = ?');  params.push(name); }
  if (email !== undefined) { fields.push('email = ?'); params.push(email); }
  if (phone !== undefined) { fields.push('phone = ?'); params.push(phone); }
  if (fields.length) await query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, [...params, req.user.id]);
  res.json({ ok: true });
}

/* PUT /api/settings/password */
async function updatePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Password lama dan baru wajib diisi.' });

  const rows = await query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!match) return res.status(401).json({ error: 'Password lama salah.' });

  const hash = await bcrypt.hash(newPassword, 10);
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
  res.json({ ok: true });
}

/* PUT /api/settings/preferences  { notif, display } */
async function updatePreferences(req, res) {
  const { notif, display } = req.body;
  await query(
    `INSERT INTO user_settings (user_id, notif, display) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE notif = VALUES(notif), display = VALUES(display)`,
    [req.user.id, JSON.stringify(notif || {}), JSON.stringify(display || {})]
  );
  res.json({ ok: true });
}

module.exports = { get, updateProfile, updatePassword, updatePreferences };
