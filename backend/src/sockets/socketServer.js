/**
 * DRCC — WebSocket (Socket.io) Server
 * Authenticates connections via JWT, joins role-based rooms,
 * provides broadcast helpers used by controllers.
 */
'use strict';
const { Server } = require('socket.io');
const { verifyAccessToken } = require('../config/jwt');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN || process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Auth middleware for socket handshake
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('NO_TOKEN'));
      const decoded = verifyAccessToken(token);
      socket.userId   = decoded.sub;
      socket.role     = decoded.role;
      socket.username = decoded.username;
      next();
    } catch (err) {
      next(new Error('INVALID_TOKEN'));
    }
  });

  io.on('connection', (socket) => {
    // Join personal room + role room + global room
    socket.join(`user:${socket.userId}`);
    socket.join(`role:${socket.role}`);
    socket.join('all');

    console.log(`🔌 Socket connected: ${socket.username} (${socket.role}) — ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.username} — ${socket.id}`);
    });
  });

  console.log('✅ Socket.io initialized');
  return io;
}

function getIo() {
  if (!io) throw new Error('Socket.io not initialized yet');
  return io;
}

/* ============================================================
   BROADCAST HELPERS — used by controllers after DB writes
   ============================================================ */

/** Broadcast to everyone connected */
function broadcastAll(event, payload) {
  if (!io) return;
  io.to('all').emit(event, payload);
}

/** Broadcast to specific roles only, e.g. ['admin','operator'] */
function broadcastToRoles(roles, event, payload) {
  if (!io) return;
  roles.forEach(role => io.to(`role:${role}`).emit(event, payload));
}

/** Send to a single user by id */
function sendToUser(userId, event, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

module.exports = { initSocket, getIo, broadcastAll, broadcastToRoles, sendToUser };
