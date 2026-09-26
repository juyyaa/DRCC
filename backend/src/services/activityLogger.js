/**
 * DRCC — Activity Logger Service
 * Writes to activity_logs table for every significant action (5 Layer tracking)
 */
'use strict';
const { query } = require('../config/db');

const LAYER_NAMES = {
  0: 'System', 1: 'Layer 1: Input Signal', 2: 'Layer 2: Signal Processing',
  3: 'Layer 3: AI Agent', 4: 'Layer 4: Prediction/Decision', 5: 'Layer 5: User Action',
};

async function log({ userId = null, action, layer = 0, data = {}, page = null, ip = null }) {
  try {
    await query(
      `INSERT INTO activity_logs (user_id, action, layer, layer_name, data, page, ip_address) VALUES (?,?,?,?,?,?,?)`,
      [userId, action, layer, LAYER_NAMES[layer] || 'System', JSON.stringify(data), page, ip]
    );
  } catch (err) {
    console.error('[ActivityLogger] failed:', err.message);
  }
}

const signal     = (a,d,opts={}) => log({ ...opts, action:a, data:d, layer:1 });
const processing = (a,d,opts={}) => log({ ...opts, action:a, data:d, layer:2 });
const ai         = (a,d,opts={}) => log({ ...opts, action:a, data:d, layer:3 });
const decision   = (a,d,opts={}) => log({ ...opts, action:a, data:d, layer:4 });
const action     = (a,d,opts={}) => log({ ...opts, action:a, data:d, layer:5 });

async function getLayerStatus() {
  const counts = await query(`
    SELECT
      (SELECT COUNT(*) FROM signal_events)                       AS l1,
      (SELECT COUNT(*) FROM anomalies)                            AS l2,
      (SELECT COUNT(*) FROM ai_reasoning_logs)                    AS l3,
      (SELECT COUNT(*) FROM ai_analyses)                          AS l4,
      (SELECT COUNT(*) FROM incidents)                            AS l5
  `);
  const c = counts[0] || {};
  return {
    1: Number(c.l1) > 0, 2: Number(c.l2) > 0, 3: Number(c.l3) > 0,
    4: Number(c.l4) > 0, 5: Number(c.l5) > 0,
  };
}

module.exports = { log, signal, processing, ai, decision, action, getLayerStatus };
