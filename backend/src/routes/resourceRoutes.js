/**
 * DRCC — Resource Routes
 */
'use strict';
const express = require('express');
const router = express.Router();
const resourceController = require('../controllers/resourceController');
const { requireAuth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const asyncWrap = require('../utils/asyncWrap');

router.use(requireAuth);

router.get('/stats',         checkPermission('resources','view'),   asyncWrap(resourceController.stats));
router.get('/',              checkPermission('resources','view'),   asyncWrap(resourceController.list));
router.get('/:id',           checkPermission('resources','view'),   asyncWrap(resourceController.get));
router.post('/',             checkPermission('resources','manage'), asyncWrap(resourceController.create));
router.put('/:id',           checkPermission('resources','manage'), asyncWrap(resourceController.update));
router.delete('/:id',        checkPermission('resources','manage'), asyncWrap(resourceController.remove));
router.post('/:id/assign',   checkPermission('resources','manage'), asyncWrap(resourceController.assign));
router.post('/:id/unassign', checkPermission('resources','manage'), asyncWrap(resourceController.unassign));

module.exports = router;
