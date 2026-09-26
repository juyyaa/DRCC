/**
 * DRCC — Incident Routes
 */
'use strict';
const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incidentController');
const { requireAuth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const asyncWrap = require('../utils/asyncWrap');

router.use(requireAuth);

router.get('/stats',  checkPermission('incidents','view'),   asyncWrap(incidentController.stats));
router.get('/',       checkPermission('incidents','view'),   asyncWrap(incidentController.list));
router.get('/:id',    checkPermission('incidents','view'),   asyncWrap(incidentController.get));
router.post('/',      checkPermission('incidents','manage'), asyncWrap(incidentController.create));
router.put('/:id',    checkPermission('incidents','manage'), asyncWrap(incidentController.update));
router.delete('/:id', checkPermission('incidents','manage'), asyncWrap(incidentController.remove));

module.exports = router;
