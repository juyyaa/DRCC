/**
 * DRCC — Settings Routes
 */
'use strict';
const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { requireAuth } = require('../middleware/auth');
const asyncWrap = require('../utils/asyncWrap');

router.use(requireAuth);

router.get('/',                asyncWrap(settingsController.get));
router.put('/profile',         asyncWrap(settingsController.updateProfile));
router.put('/password',        asyncWrap(settingsController.updatePassword));
router.put('/preferences',     asyncWrap(settingsController.updatePreferences));

module.exports = router;
