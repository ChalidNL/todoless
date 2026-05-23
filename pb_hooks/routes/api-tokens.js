// pb_hooks/routes/api-tokens.js
// CRUD API for API tokens management (create, list, revoke, toggle).
// Handles both PB session auth and Bearer token auth.

// ─── Helper: resolve authenticated user ────────────────────────────────────
// Returns { id, role } or null. Checks both Bearer token auth and PB session auth.
function resolveAuth(c) {
  // Check Bearer token auth first
  var tokInfo = c.get('apiTokenInfo');
  if (tokInfo) {
    return { id: tokInfo.user_id, role: tokInfo.user_role, fromToken: true };
  }
  // Fall back to PB session auth
  var info = c.requestInfo();
  var auth = info.auth || c.auth;
  if (auth) {
    return { id: auth.id, role: String(auth.get('role') || 'user'), fromToken: false };
  }
  return null;
}

// ─── LIST tokens (GET) ─────────────────────────────────────────────────────
routerAdd('GET', '/api/todoless/api-tokens', (c) => {
  try {
    var ba = bearerAuthMiddleware(c);
    if (ba) return ba;

    var auth = resolveAuth(c);
    if (!auth) return c.json(401, { error: 'Unauthorized' });

    // All authenticated users can see all tokens (multi-user)
    var filter = '';

    var tokens = $app.findRecordsByFilter('api_tokens', filter, '-created', 0, 0);

    var result = tokens.map(function(r) {
      return {
        id: r.id,
        name: String(r.get('name') || ''),
        permissions: r.get('scopes'),
        expires_at: String(r.get('expires_at') || ''),
        enabled: r.get('enabled') !== false && r.get('enabled') !== 0,
        user: String(r.get('user') || ''),
        // NEVER return token_hash to clients
        created: String(r.get('created') || ''),
      };
    });

    return c.json(200, result);
  } catch(e) {
    return c.json(400, { error: String(e) });
  }
});

// ─── CREATE token (POST) ───────────────────────────────────────────────────
routerAdd('POST', '/api/todoless/api-tokens', (c) => {
  try {
    var ba = bearerAuthMiddleware(c);
    if (ba) return ba;

    var auth = resolveAuth(c);
    if (!auth) return c.json(401, { error: 'Unauthorized' });

    var info = c.requestInfo();
    var body = info.data || info.body || {};
    var name = String(body.name || '').trim();
    var permissions = body.permissions || [];
    var expiresAt = body.expires_at || '';

    if (!name) return c.json(400, { error: 'name is required' });
    if (!Array.isArray(permissions) || permissions.length === 0) {
      return c.json(400, { error: 'permissions array is required (min 1 permission)' });
    }

    // Validate permission format
    var validActions = ['tasks:read', 'tasks:write', 'groceries:read', 'groceries:write', 'notes:read', 'notes:write', 'admin:*'];
    for (var pi = 0; pi < permissions.length; pi++) {
      var perm = String(permissions[pi] || '');
      var valid = false;
      for (var vi = 0; vi < validActions.length; vi++) {
        if (perm === validActions[vi]) { valid = true; break; }
      }
      if (perm === '*') { valid = true; }
      // Allow wildcard format: tasks:* etc
      var pParts = perm.split(':');
      if (pParts.length === 2 && pParts[1] === '*') { valid = true; }
      if (!valid) return c.json(400, { error: 'Invalid permission: ' + perm });
    }

    // Generate token
    var rawToken = generateToken(48);

    // Hash it
    var hashed = hashToken(rawToken);

    var coll = $app.findCollectionByNameOrId('api_tokens');
    var rec = new Record(coll);

    rec.set('name', name);
    rec.set('token_hash', hashed);
    rec.set('scopes', permissions);
    rec.set('user', auth.id);

    // Try to set optional fields — ignore if collection schema doesn't have them
    try { rec.set('enabled', true); } catch(e) {}
    if (expiresAt) {
      try { rec.set('expires_at', expiresAt); } catch(e) {}
    }

    $app.save(rec);

    return c.json(201, {
      id: rec.id,
      name: name,
      token: rawToken,   // ONE-TIME return — never stored in plaintext
      permissions: permissions,
      enabled: true,
      expires_at: expiresAt || null,
      user: auth.id,
      created: new Date().toISOString(),
      message: 'Save this token — it will not be shown again.',
    });
  } catch(e) {
    return c.json(400, { error: String(e) });
  }
});

// ─── DELETE / revoke token ─────────────────────────────────────────────────
routerAdd('DELETE', '/api/todoless/api-tokens/:id', (c) => {
  try {
    var ba = bearerAuthMiddleware(c);
    if (ba) return ba;

    var auth = resolveAuth(c);
    if (!auth) return c.json(401, { error: 'Unauthorized' });

    var tokenId = c.pathParam('id') || '';
    if (!tokenId) return c.json(400, { error: 'token id required' });

    var rec = $app.findRecordById('api_tokens', tokenId);
    if (!rec) return c.json(404, { error: 'Token not found' });

    var tokenOwner = String(rec.get('user') || '');

    // Only owner or admin can delete
    if (tokenOwner !== auth.id && auth.role !== 'admin') {
      return c.json(403, { error: 'Forbidden' });
    }

    $app.delete(rec);
    return c.json(200, { ok: true, id: tokenId, message: 'Token revoked' });
  } catch(e) {
    return c.json(400, { error: String(e) });
  }
});

// ─── TOGGLE enabled/disabled ───────────────────────────────────────────────
routerAdd('PATCH', '/api/todoless/api-tokens/:id/toggle', (c) => {
  try {
    var ba = bearerAuthMiddleware(c);
    if (ba) return ba;

    var auth = resolveAuth(c);
    if (!auth) return c.json(401, { error: 'Unauthorized' });

    var tokenId = c.pathParam('id') || '';
    if (!tokenId) return c.json(400, { error: 'token id required' });

    var rec = $app.findRecordById('api_tokens', tokenId);
    if (!rec) return c.json(404, { error: 'Token not found' });

    var tokenOwner = String(rec.get('user') || '');

    // Only owner or admin can toggle
    if (tokenOwner !== auth.id && auth.role !== 'admin') {
      return c.json(403, { error: 'Forbidden' });
    }

    var info = c.requestInfo();
    var body = info.data || info.body || {};
    var enabled = body.enabled;
    if (typeof enabled !== 'boolean') {
      return c.json(400, { error: 'enabled boolean field required' });
    }

    rec.set('enabled', enabled);
    try { $app.save(rec); } catch(e) {
      // Collection might not have 'enabled' field — fallback gracefully
      return c.json(200, { ok: true, id: tokenId, enabled: enabled, note: 'Field not persisted' });
    }

    return c.json(200, {
      ok: true,
      id: tokenId,
      enabled: enabled,
    });
  } catch(e) {
    return c.json(400, { error: String(e) });
  }
});
