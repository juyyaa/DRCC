/**
 * DRCC — Notification Routes
 */
'use strict';
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncWrap = require('../utils/asyncWrap');

router.use(requireAuth);

router.get('/',                       asyncWrap(notificationController.list));
router.post('/mark-read/:id',         asyncWrap(notificationController.markRead));
router.post('/mark-all-read',         asyncWrap(notificationController.markAllRead));
router.post('/',  requireRole('admin','operator'), asyncWrap(notificationController.create));

module.exports = router;
