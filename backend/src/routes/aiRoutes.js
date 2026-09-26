/**
 * DRCC — AI Command Routes
 */
'use strict';
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const aiController = require('../controllers/aiController');
const { requireAuth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const asyncWrap = require('../utils/asyncWrap');

router.use(requireAuth);

/* AI calls cost money — rate-limit per IP to control Gemini API spend */
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AI_RATE_LIMIT_MAX) || 20,
  message: { error: 'Batas analisis AI tercapai. Coba lagi nanti.' },
});

router.get('/history',        checkPermission('aiCommand','view'),   asyncWrap(aiController.history));
router.get('/analysis/:id',   checkPermission('aiCommand','view'),   asyncWrap(aiController.getAnalysis));
router.post('/analyze', aiLimiter, checkPermission('aiCommand','manage'), asyncWrap(aiController.analyze));

module.exports = router;
