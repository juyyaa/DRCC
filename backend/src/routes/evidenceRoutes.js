/**
 * DRCC — Evidence / Demo Center Routes
 */
'use strict';
const express = require('express');
const router = express.Router();
const evidenceController = require('../controllers/evidenceController');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncWrap = require('../utils/asyncWrap');

router.use(requireAuth, requireRole('admin', 'operator'));

router.get('/summary',                  asyncWrap(evidenceController.summary));
router.get('/export',                   asyncWrap(evidenceController.exportJSON));
router.get('/scenarios/completed',      asyncWrap(evidenceController.completedScenarios));
router.post('/scenarios/:scenarioId/run', asyncWrap(evidenceController.runScenario));

module.exports = router;
