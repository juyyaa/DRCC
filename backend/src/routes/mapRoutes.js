/**
 * DRCC — Map Marker Routes
 */
'use strict';
const express = require('express');
const router = express.Router();
const mapController = require('../controllers/mapController');
const { requireAuth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const asyncWrap = require('../utils/asyncWrap');

router.use(requireAuth);

router.get('/',       checkPermission('map','view'),   asyncWrap(mapController.list));
router.get('/:id',    checkPermission('map','view'),   asyncWrap(mapController.get));
router.post('/',      checkPermission('map','manage'), asyncWrap(mapController.create));
router.put('/:id',    checkPermission('map','manage'), asyncWrap(mapController.update));
router.delete('/:id', checkPermission('map','manage'), asyncWrap(mapController.remove));

module.exports = router;
