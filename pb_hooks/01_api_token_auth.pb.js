// pb_hooks/01_api_token_auth.pb.js
// Bearer token authentication middleware for external agent access.
// Checks Authorization: Bearer *** header, looks up hashed token in api_tokens collection.
// Sets apiTokenInfo on the request context for downstream handlers.
// Backward compatible: falls through to PB session auth when no Bearer header is present.
//
// Functions registered on globalThis so they're accessible from require()'d route modules.

// ─── SHA-256 hash ──────────────────────────────────────
function hashToken(token) {
  try {
    return $security.SHA256(token);
  } catch(e) {
    var hash = 0;
    if (token.length === 0) return 'dev_hash_empty';
    for (var i = 0; i < token.length; i++) {
      var char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'd_' + Math.abs(hash).toString(16).padStart(8, '0');
  }
}

function generateToken(length) {
  if (typeof length === 'undefined') length = 48;
  var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var result = '';
  for (var i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return 'tl_' + result;
}

// ─── Bearer token auth middleware ─────────────────────
// Returns null if no token auth (let PB auth handle it), or a 401 response.
// After success: c.get('apiTokenInfo') contains { token_record, permissions, user_id, name }
function bearerAuthMiddleware(c) {
  try {
    var authHeader = c.requestInfo().headers['authorization'];
    if (!authHeader) return null;

    var parts = String(authHeader).split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
      return c.json(401, { 'error': 'Invalid Authorization header format. Use: Bearer <token>' });
    }

    var token = parts[1].trim();
    if (!token) return c.json(401, { 'error': 'Empty token' });

    var hashed = hashToken(token);

    var tokens = $app.findRecordsByFilter(
      'api_tokens',
      'token_hash = "' + hashed + '"',
      '',
      1,
      0
    );

    if (tokens.length === 0) {
      return null;
    }

    var tokRec = tokens[0];

    // Check enabled
    var rawEnabled = tokRec.get('enabled');
    var isEnabled = rawEnabled !== false && rawEnabled !== 0 && rawEnabled !== 'false';
    if (!isEnabled) {
      return c.json(401, { 'error': 'API token is disabled' });
    }

    // Check expiry
    var rawExp = tokRec.get('expires_at');
    if (rawExp) {
      var expMs = 0;
      if (typeof rawExp === 'string') expMs = new Date(rawExp).getTime();
      else if (rawExp && typeof rawExp.getTime === 'function') expMs = rawExp.getTime();
      else if (rawExp) expMs = new Date(String(rawExp)).getTime();

      var nowMs = new Date().getTime();
      if (expMs > 0 && expMs < nowMs) {
        return c.json(401, { 'error': 'API token has expired' });
      }
    }

    // Resolve user
    var userId = String(tokRec.get('user') || '');
    var user = null;
    try {
      user = $app.findRecordById('users', userId);
    } catch(e) {
      return c.json(401, { 'error': 'Token owner not found' });
    }

    if (!user) return c.json(401, { 'error': 'Token owner not found' });

    // Check user is active and approved
    var rawActive = user.get('active');
    var isBlocked = (rawActive === false || rawActive === 0 || rawActive === 'false');
    if (isBlocked) return c.json(403, { 'error': 'Token owner account is blocked' });
    var rawMemberStatus = user.get('member_status');
    if (rawMemberStatus === 'blocked') return c.json(403, { 'error': 'Token owner account is blocked' });
    if (rawMemberStatus === 'pending_approval') return c.json(403, { 'error': 'Token owner is pending approval' });

    // Parse permissions (prefer 'permissions', fallback 'scopes')
    var rawPerms = tokRec.get('permissions');
    if (!rawPerms || (Array.isArray(rawPerms) && rawPerms.length === 0)) {
      rawPerms = tokRec.get('scopes');
    }
    var perms = [];
    if (Array.isArray(rawPerms)) {
      perms = rawPerms;
    } else if (typeof rawPerms === 'string') {
      try { perms = JSON.parse(rawPerms); } catch(e) {}
    }

    // Set token info on context for downstream handlers
    c.set('apiTokenInfo', {
      token_id: tokRec.id,
      token_name: String(tokRec.get('name') || ''),
      user_id: user.id,
      user_role: String(user.get('role') || 'user'),
      user_name: String(user.get('name') || user.get('email') || ''),
      family_id: String(user.get('family_id') || ''),
      permissions: perms,
    });

    // Also set authRecord so $apis.requireRecordAuth() and info.auth work
    c.set('authRecord', user);

    return null; // Auth OK — continue
  } catch(e) {
    return c.json(500, { 'error': 'Token auth error: ' + String(e) });
  }
}

// ─── Permission check helper ───────────────────────────
function checkTokenPermission(c, required) {
  try {
    var tokInfo = c.get('apiTokenInfo');
    if (!tokInfo) return true;
    var perms = tokInfo.permissions || [];
    if (!Array.isArray(perms)) perms = [];

    for (var i = 0; i < perms.length; i++) {
      var p = String(perms[i] || '');
      if (p === required) return true;
      var parts = p.split(':');
      var reqParts = required.split(':');
      if (parts.length === 2 && parts[1] === '*' && parts[0] === reqParts[0]) return true;
      if (p === '*') return true;
    }

    return false;
  } catch(e) {
    return false;
  }
}

// ─── Register on globalThis so require()'d modules can access them ──
globalThis.hashToken = hashToken;
globalThis.generateToken = generateToken;
globalThis.bearerAuthMiddleware = bearerAuthMiddleware;
globalThis.checkTokenPermission = checkTokenPermission;
