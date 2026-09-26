/**
 * DRCC — Socket Client
 * Koneksi WebSocket real-time, terhubung otomatis setelah login.
 * Event dari server di-relay ke State pub/sub system (lihat state.js)
 * sehingga semua halaman bisa subscribe tanpa perlu tahu detail socket.
 */
'use strict';

const SocketClient = {
  _socket: null,

  connect() {
    if (this._socket?.connected) return this._socket;
    const token = ApiClient.getAccessToken();
    if (!token || typeof io === 'undefined') return null;

    this._socket = io(window.DRCC_CONFIG?.SOCKET_URL || 'http://localhost:4000', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    this._socket.on('connect',    () => console.log('🔌 [Socket] Connected:', this._socket.id));
    this._socket.on('disconnect', (reason) => console.log('🔌 [Socket] Disconnected:', reason));
    this._socket.on('connect_error', (err) => console.warn('🔌 [Socket] Connection error:', err.message));

    /* Relay every known server event into the local State pub/sub,
       so page-specific JS can simply do State.on('incident:created', cb) */
    const RELAYED_EVENTS = [
      'incident:created', 'incident:updated', 'incident:deleted',
      'resource:created', 'resource:updated', 'resource:deleted',
      'marker:created', 'marker:updated', 'marker:deleted',
      'signal:created', 'signal:updated', 'signal:processed',
      'anomaly:new',
      'ai:analysis:complete',
      'demo:scenario:complete',
      'notification:new',
      'user:created', 'user:updated', 'user:deleted',
    ];
    RELAYED_EVENTS.forEach(evt => {
      this._socket.on(evt, (payload) => {
        if (window.State) State._emit(evt, payload);
        // Notifications also show as Toast immediately
        if (evt === 'notification:new' && window.Toast) {
          const fn = { success: Toast.success, error: Toast.error, warning: Toast.warning, info: Toast.info }[payload.type] || Toast.info;
          fn(payload.title, payload.message || '');
        }
        // Update notif badge count live
        if (evt === 'notification:new' && window.State?._updateBadge) {
          const badge = document.getElementById('notif-badge');
          if (badge) {
            const current = parseInt(badge.textContent) || 0;
            badge.textContent = current + 1;
            badge.style.display = '';
          }
        }
      });
    });

    return this._socket;
  },

  disconnect() {
    if (this._socket) { this._socket.disconnect(); this._socket = null; }
  },

  emit(event, payload) {
    this._socket?.emit(event, payload);
  },
};

window.SocketClient = SocketClient;
