/**
 * DRCC — ID generator helpers
 */
'use strict';
const { query } = require('../config/db');

/**
 * Generate next sequential ID like INC-001, RES-042
 * by counting existing rows + 1, padded to 3 digits (overflow naturally to 4+ digits).
 */
async function nextId(table, prefix) {
  const rows = await query(`SELECT COUNT(*) AS cnt FROM ${table}`);
  const n = (rows[0]?.cnt || 0) + 1;
  return `${prefix}-${String(n).padStart(3, '0')}`;
}

/** Random alphanumeric suffix, useful for non-sequential unique IDs */
function randomId(prefix, len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${Date.now()}-${s}`;
}

module.exports = { nextId, randomId };
