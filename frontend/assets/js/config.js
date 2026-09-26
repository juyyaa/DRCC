/**
 * DRCC — Frontend Runtime Config
 * EDIT INI saat deploy ke VPS — ganti dengan domain/IP server backend Anda.
 */
'use strict';
window.DRCC_CONFIG = {
  // Saat development lokal (file dibuka dari Live Server / localhost):
  API_BASE_URL: 'http://localhost:4000/api',
  SOCKET_URL:   'http://localhost:4000',

  // Saat production di VPS, ganti ke domain Anda, contoh:
  // API_BASE_URL: 'https://drcc.namadomain.com/api',
  // SOCKET_URL:   'https://drcc.namadomain.com',
};
