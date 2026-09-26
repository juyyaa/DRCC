/**
 * DRCC — User Management Routes (admin only)
 */
'use strict';
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncWrap = require('../utils/asyncWrap');

router.use(requireAuth, requireRole('admin'));

router.get('/',     asyncWrap(userController.list));
router.get('/:id',  asyncWrap(userController.get));
router.post('/',    asyncWrap(userController.create));
router.put('/:id',  asyncWrap(userController.update));
router.delete('/:id', asyncWrap(userController.remove));

module.exports = router;
