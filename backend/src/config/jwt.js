/**
 * DRCC — JWT configuration and token helpers
 */
'use strict';
const jwt = require('jsonwebtoken');
require('dotenv').config();

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES  = process.env.JWT_ACCESS_EXPIRES  || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  console.warn('⚠️  JWT secrets not set in .env — using insecure fallback. DO NOT use in production!');
}

function signAccessToken(payload) {
  return jwt.sign(payload, ACCESS_SECRET || 'insecure_fallback_access', { expiresIn: ACCESS_EXPIRES });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, REFRESH_SECRET || 'insecure_fallback_refresh', { expiresIn: REFRESH_EXPIRES });
}

function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET || 'insecure_fallback_access');
}

function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET || 'insecure_fallback_refresh');
}

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };
