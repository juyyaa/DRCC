/**
 * DRCC — Signal Routes
 */
'use strict';
const express = require('express');
const router = express.Router();
const signalController = require('../controllers/signalController');
const { requireAuth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const asyncWrap = require('../utils/asyncWrap');

router.use(requireAuth);

router.get('/processing-log', checkPermission('signals','view'),   asyncWrap(signalController.processingLog));
router.get('/anomalies',      checkPermission('signals','view'),   asyncWrap(signalController.anomalies));
router.get('/',                checkPermission('signals','view'),   asyncWrap(signalController.list));
router.post('/',               checkPermission('signals','manage'), asyncWrap(signalController.create));
router.post('/:id/process',    checkPermission('signals','manage'), asyncWrap(signalController.process));
router.post('/:id/toggle',     checkPermission('signals','manage'), asyncWrap(signalController.toggleStatus));

module.exports = router;
