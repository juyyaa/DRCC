/**
 * DRCC — Auth Routes
 */
'use strict';
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const asyncWrap = require('../utils/asyncWrap');

/* Stricter rate limit on login to slow down brute-force attempts */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi nanti.' },
});

router.post('/login',   loginLimiter, asyncWrap(authController.login));
router.post('/refresh', asyncWrap(authController.refresh));
router.post('/logout',  asyncWrap(authController.logout));
router.get('/me',       requireAuth, asyncWrap(authController.me));

module.exports = router;
