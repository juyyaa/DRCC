/**
 * DRCC — Express Application
 * Setup middleware global, routes, dan error handler
 */
'use strict';
require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const compression = require('compression');
const rateLimit   = require('express-rate-limit');

const app = express();

/* ---- SECURITY & PARSING MIDDLEWARE ---- */
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

/* ---- GLOBAL RATE LIMIT ---- */
app.use('/api/', rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

/* ---- HEALTH CHECK ---- */
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

/* ---- API ROUTES ---- */
app.use('/api/auth',          require('./routes/authRoutes'));
app.use('/api/users',         require('./routes/userRoutes'));
app.use('/api/incidents',     require('./routes/incidentRoutes'));
app.use('/api/resources',     require('./routes/resourceRoutes'));
app.use('/api/map-markers',   require('./routes/mapRoutes'));
app.use('/api/signals',       require('./routes/signalRoutes'));
app.use('/api/ai',            require('./routes/aiRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/history',       require('./routes/historyRoutes'));
app.use('/api/settings',      require('./routes/settingsRoutes'));
app.use('/api/dashboard',     require('./routes/dashboardRoutes'));
app.use('/api/evidence',      require('./routes/evidenceRoutes'));

/* ---- 404 HANDLER ---- */
app.use('/api/', (req, res) => res.status(404).json({ error: `Endpoint tidak ditemukan: ${req.method} ${req.originalUrl}` }));

/* ---- GLOBAL ERROR HANDLER ---- */
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  if (process.env.NODE_ENV !== 'production') console.error(err.stack);

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Data sudah ada (duplikat).' });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({ error: 'Operasi gagal karena keterkaitan data lain.' });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Terjadi kesalahan pada server.' : err.message,
  });
});

module.exports = app;
