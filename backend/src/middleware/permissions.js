/**
 * DRCC — Page/Resource permission matrix
 * Defines which roles can access which API resource & action.
 * Used by routes to enforce fine-grained access beyond simple role check.
 */
'use strict';

/**
 * Format: resource -> { action: [roles allowed] }
 * action 'view' = GET, 'manage' = POST/PUT/DELETE
 */
const PERMISSIONS = {
  dashboard:    { view: ['admin','operator','relawan','pemda'] },
  signals:      { view: ['admin','operator','pemda'],           manage: ['admin','operator'] },
  map:          { view: ['admin','operator','relawan','pemda'], manage: ['admin','operator','relawan'] },
  aiCommand:    { view: ['admin','operator'],                    manage: ['admin','operator'] },
  incidents:    { view: ['admin','operator','relawan','pemda'], manage: ['admin','operator','relawan'] },
  resources:    { view: ['admin','operator','relawan','pemda'], manage: ['admin','operator'] },
  predictions:  { view: ['admin','operator','pemda'] },
  history:      { view: ['admin','operator','relawan','pemda'] },
  settings:     { view: ['admin','operator','relawan','pemda'], manage: ['admin','operator','relawan','pemda'] },
  userManagement: { view: ['admin'], manage: ['admin'] },
  demoCenter:   { view: ['admin','operator'],                    manage: ['admin','operator'] },
};

/** Middleware factory: checkPermission('incidents', 'manage') */
function checkPermission(resource, action = 'view') {
  return (req, res, next) => {
    const role = req.user?.role;
    const allowed = PERMISSIONS[resource]?.[action] || [];
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ error: `Role '${role || 'guest'}' tidak memiliki akses ${action} ke ${resource}.` });
    }
    next();
  };
}

/** Returns the full permission map for a given role (used by GET /api/auth/me) */
function getPermissionsForRole(role) {
  const result = {};
  for (const [resource, actions] of Object.entries(PERMISSIONS)) {
    result[resource] = {
      view:   (actions.view   || []).includes(role),
      manage: (actions.manage || []).includes(role),
    };
  }
  return result;
}

module.exports = { PERMISSIONS, checkPermission, getPermissionsForRole };
