/**
 * DRCC — Dashboard Routes
 */
'use strict';
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/auth');
const asyncWrap = require('../utils/asyncWrap');

router.use(requireAuth);
router.get('/summary', asyncWrap(dashboardController.summary));

module.exports = router;
