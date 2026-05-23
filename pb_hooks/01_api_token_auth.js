// pb_hooks/01_api_token_auth.js
// Bearer token authentication middleware for external agent access.
// Checks Authorization: Bearer <token> header, looks up hashed token in api_tokens collection.
// Sets apiTokenInfo on the request context for downstream handlers.
// Backward compatible: falls through to PB session auth when no Bearer header is present.

// ─── SHA-256 hash in plain JS (no crypto API in Goja) ──────────────────────
// This is not a real SHA-256. In PB 0.34's Goja runtime, we don't have access to
// the Web Crypto API. We use a simple hex-encoded hash approach:
// For production, PocketBase stores the hash server-side. Here we use a fast
// non-crypto hash as a lookup key. The token is never stored in plaintext.
// Instead of implementing SHA-256 from scratch, we use the fact that tokens
// are server-generated and use a truncated UUID-style token with a prefix that
// we can hash.
//
// IMPORTANT: In PB 0.34 Goja, we CAN use $os.randomString() for generation
// and store $security.SHA256(token) as the hash.
// See: https://pocketbase.io/docs/js-runtime/#security

function hashToken(token) {
  // Use $security.SHA256 if available (PB 0.34+)
  try {
    return $security.SHA256(token);
  } catch(e) {
    // Fallback: simple hash for dev/testing — NOT suitable for production
    var hash = 0;
    if (token.length === 0) return 'dev_hash_empty';
    for (var i = 0; i < token.length; i++) {
      var char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return 'dev_' + Math.abs(hash).toString(16).padStart(8, '0');
  }
}

function generateToken(length) {
  if (typeof length === 'undefined') length = 48;
  chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result = '';
  for (var i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return 'tl_' + result;
}

// ─── Bearer token auth middleware ──────────────────────────────────────────
// Returns null if no token auth (let PB auth handle it), or a 401 response.
// Usage in route: var ba = bearerAuthMiddleware(c); if (ba) return ba;
// After success: c.get('apiTokenInfo') contains { token_record, permissions, user_id, name }
function bearerAuthMiddleware(c) {
  try {
    var authHeader = c.request().header.get('Authorization');
    if (!authHeader) return null; // No token — fall through

    // Parse Bearer token
    var parts = String(authHeader).split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
      return c.json(401, { 'error': 'Invalid Authorization header format. Use: Bearer <token>' });
    }

    var token = parts[1].trim();
    if (!token) return c.json(401, { 'error': 'Empty token' });

    // Hash and look up
    var hashed = hashToken(token);

    var tokens = $app.findRecordsByFilter(
      'api_tokens',
      'token_hash = "' + hashed + '"',
      '-created',
      1,
      0
    );

    if (tokens.length === 0) {
      return null; // Not an API token — fall through to PB session auth
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

    // Check user is active
    var rawActive = user.get('active');
    var isBlocked = (rawActive === false || rawActive === 0 || rawActive === 'false');
    if (isBlocked) return c.json(403, { 'error': 'Token owner account is blocked' });

    // Parse permissions (stored as 'permissions' in collection, fallback to 'scopes')
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

    // Also set authRecord so $apis.requireRecordAuth() and info.auth work too
    c.set('authRecord', user);

    return null; // Auth OK — continue
  } catch(e) {
    return c.json(500, { 'error': 'Token auth error: ' + String(e) });
  }
}

// ─── Permission check helper ───────────────────────────────────────────────
// Checks if a token has a specific permission (or wildcard).
// Used in route handlers: if (!checkTokenPermission(c, 'tasks:read')) return c.json(403, ...)
function checkTokenPermission(c, required) {
  try {
    var tokInfo = c.get('apiTokenInfo');
    if (!tokInfo) return true; // No token auth — let PB auth handle perms
    var perms = tokInfo.permissions || [];
    if (!Array.isArray(perms)) perms = [];

    for (var i = 0; i < perms.length; i++) {
      var p = String(perms[i] || '');
      if (p === required) return true;
      // Wildcard match: tasks:* matches tasks:read, tasks:write, etc.
      var parts = p.split(':');
      var reqParts = required.split(':');
      if (parts.length === 2 && parts[1] === '*' && parts[0] === reqParts[0]) return true;
      // Global wildcard
      if (p === '*') return true;
    }

    return false;
  } catch(e) {
    return false;
  }
}
