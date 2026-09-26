/**
 * DRCC — Authentication & Authorization middleware
 */
'use strict';
const { verifyAccessToken } = require('../config/jwt');
const { query } = require('../config/db');

/** Require a valid access token; attaches req.user = { id, username, role, name } */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token tidak ditemukan. Silakan login.' });

    const decoded = verifyAccessToken(token);

    // Confirm user still exists & active (defends against deleted/disabled accounts with old tokens)
    const rows = await query('SELECT id, username, role, name, status, province FROM users WHERE id = ? LIMIT 1', [decoded.sub]);
    const user = rows[0];
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Akun tidak aktif atau tidak ditemukan.' });
    }

    req.user = { id: user.id, username: user.username, role: user.role, name: user.name, province: user.province };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token kedaluwarsa.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Token tidak valid.' });
  }
}

/** Restrict route to specific roles. Usage: requireRole('admin','operator') */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Belum login.' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Anda tidak memiliki akses ke fitur ini.' });
    }
    next();
  };
}

/** Optional auth: attaches req.user if token present & valid, otherwise continues anonymously */
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const decoded = verifyAccessToken(token);
    const rows = await query('SELECT id, username, role, name, province FROM users WHERE id = ? LIMIT 1', [decoded.sub]);
    if (rows[0]) req.user = rows[0];
  } catch (e) { /* ignore invalid token in optional mode */ }
  next();
}

module.exports = { requireAuth, requireRole, optionalAuth };
