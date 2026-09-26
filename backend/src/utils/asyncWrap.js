/**
 * DRCC — Async route handler wrapper
 * Catches rejected promises from async controllers and forwards to Express error handler
 */
'use strict';
function asyncWrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
module.exports = asyncWrap;
