/**
 * DRCC — History Routes
 */
'use strict';
const express = require('express');
const router = express.Router();
const historyController = require('../controllers/historyController');
const { requireAuth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const asyncWrap = require('../utils/asyncWrap');

router.use(requireAuth);
router.get('/stats', checkPermission('history','view'), asyncWrap(historyController.stats));
router.get('/',       checkPermission('history','view'), asyncWrap(historyController.list));

module.exports = router;
