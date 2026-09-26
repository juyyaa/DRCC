/**
 * DRCC — Dashboard Controller
 * Ringkasan stats lintas modul untuk halaman Dashboard
 */
'use strict';
const { query } = require('../config/db');
const activityLogger = require('../services/activityLogger');

async function summary(req, res) {
  const [incStats] = await query(`
    SELECT COUNT(*) AS total, COALESCE(SUM(status='aktif'),0) AS aktif, COALESCE(SUM(severity='BAHAYA'),0) AS bahaya
    FROM incidents`);
  const [resStats] = await query(`
    SELECT COUNT(*) AS total, COALESCE(SUM(status='tersedia'),0) AS tersedia, COALESCE(SUM(status='deployed'),0) AS deployed
    FROM resources`);
  const [aiCount]  = await query('SELECT COUNT(*) AS c FROM ai_analyses');
  const byType     = await query('SELECT type, COUNT(*) AS count FROM incidents GROUP BY type');
  const trend       = await query(`
    SELECT DATE(created_at) AS d, COUNT(*) AS count FROM incidents
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY DATE(created_at) ORDER BY d ASC`);
  const layerStatus = await activityLogger.getLayerStatus();

  res.json({
    incidents: incStats, resources: resStats, aiAnalyses: aiCount.c,
    byType, trend, layerStatus,
  });
}

module.exports = { summary };
