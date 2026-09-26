/**
 * DRCC — Server Entry Point
 * Boots Express app, attaches Socket.io, tests DB connection
 */
'use strict';
require('dotenv').config();
const http = require('http');
const app = require('./app');
const { testConnection } = require('./config/db');
const { initSocket } = require('./sockets/socketServer');

const PORT = process.env.PORT || 4000;

async function start() {
  const dbOk = await testConnection();
  if (!dbOk) {
    console.error('❌ Tidak bisa terhubung ke database. Periksa konfigurasi .env Anda.');
    if (process.env.NODE_ENV === 'production') process.exit(1);
  }

  const httpServer = http.createServer(app);
  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║   DRCC Backend API                                      ║
║   🚀 Running on port ${PORT}                               ║
║   🌐 http://localhost:${PORT}/api/health                   ║
║   📡 WebSocket ready                                     ║
║   🤖 Gemini AI: ${process.env.GEMINI_API_KEY ? 'Configured ✅' : 'NOT SET (fallback mode) ⚠️'}
╚════════════════════════════════════════════════════════╝
    `);
  });

  process.on('SIGTERM', () => { console.log('SIGTERM received, closing server...'); httpServer.close(() => process.exit(0)); });
  process.on('SIGINT',  () => { console.log('SIGINT received, closing server...');  httpServer.close(() => process.exit(0)); });
}

start();
