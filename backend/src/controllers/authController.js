/**
 * DRCC — Auth Controller
 * login, refresh token, logout, get current user (/me)
 */
'use strict';
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../config/db');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../config/jwt');
const { getPermissionsForRole } = require('../middleware/permissions');
const activityLogger = require('../services/activityLogger');

const REFRESH_EXPIRES_DAYS = 7;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/* POST /api/auth/login */
async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  }

  const rows = await query('SELECT * FROM users WHERE username = ? LIMIT 1', [username.trim()]);
  const user = rows[0];

  if (!user) return res.status(401).json({ error: 'Username atau password salah.' });
  if (user.status !== 'active') return res.status(403).json({ error: 'Akun Anda telah dinonaktifkan. Hubungi admin.' });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Username atau password salah.' });

  const payload = { sub: user.id, username: user.username, role: user.role };
  const accessToken  = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // Persist refresh token (hashed) for revocation support
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 86400000);
  await query(
    'INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip_address, expires_at) VALUES (?,?,?,?,?)',
    [user.id, hashToken(refreshToken), req.headers['user-agent'] || null, req.ip, expiresAt]
  );

  await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
  await activityLogger.action('USER_LOGIN', { username: user.username, role: user.role }, { userId: user.id, page: 'login', ip: req.ip });

  res.cookie?.('refreshToken', refreshToken, { httpOnly: true, sameSite: 'lax', maxAge: REFRESH_EXPIRES_DAYS * 86400000 });

  res.json({
    accessToken,
    refreshToken, // also returned in body for clients not using cookies (mobile, etc.)
    user: {
      id: user.id, username: user.username, role: user.role,
      name: user.name, email: user.email, province: user.province,
    },
    permissions: getPermissionsForRole(user.role),
  });
}

/* POST /api/auth/refresh */
async function refresh(req, res) {
  const token = req.body.refreshToken || req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: 'Refresh token tidak ditemukan.' });

  let decoded;
  try { decoded = verifyRefreshToken(token); }
  catch { return res.status(401).json({ error: 'Refresh token tidak valid atau kedaluwarsa.' }); }

  const hash = hashToken(token);
  const rows = await query(
    'SELECT * FROM refresh_tokens WHERE token_hash = ? AND user_id = ? AND revoked = 0 LIMIT 1',
    [hash, decoded.sub]
  );
  if (!rows[0]) return res.status(401).json({ error: 'Refresh token sudah tidak berlaku.' });
  if (new Date(rows[0].expires_at) < new Date()) return res.status(401).json({ error: 'Refresh token kedaluwarsa.' });

  const userRows = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [decoded.sub]);
  const user = userRows[0];
  if (!user || user.status !== 'active') return res.status(401).json({ error: 'Akun tidak aktif.' });

  const accessToken = signAccessToken({ sub: user.id, username: user.username, role: user.role });
  res.json({ accessToken });
}

/* POST /api/auth/logout */
async function logout(req, res) {
  const token = req.body.refreshToken || req.cookies?.refreshToken;
  if (token) {
    try {
      await query('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?', [hashToken(token)]);
    } catch (e) {}
  }
  if (req.user) {
    await activityLogger.action('USER_LOGOUT', { username: req.user.username }, { userId: req.user.id, page: 'system', ip: req.ip });
  }
  res.clearCookie?.('refreshToken');
  res.json({ ok: true });
}

/* GET /api/auth/me */
async function me(req, res) {
  const rows = await query(
    'SELECT id, username, role, name, email, phone, province, last_login_at FROM users WHERE id = ? LIMIT 1',
    [req.user.id]
  );
  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });
  res.json({ user, permissions: getPermissionsForRole(user.role) });
}

module.exports = { login, refresh, logout, me };
