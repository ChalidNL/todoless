// pb_hooks/09_api_tokens.pb.js
// CRUD API for API tokens management (create, list, revoke, toggle).
// Auto-loaded by PB — no require() needed.
// Shared helpers are loaded inside callbacks via require(__hooks + '/lib/auth.js').

// ─── LIST tokens (GET) ─────────────────────────────────────────────────────
routerAdd('GET', '/api/api-tokens', (c) => {
  var authLib = require(__hooks + '/lib/auth.js');
  var _bam = authLib.bearerAuthMiddleware;

try {
    var ba = _bam(c);
    if (ba) return ba;

    var _ti = c.get('apiTokenInfo');
    var auth = null;
    if (_ti) { auth = { id: _ti.user_id, role: _ti.user_role, family_id: String(_ti.family_id || ''), fromToken: true }; } else { var _i = c.requestInfo(); var _a = _i.auth || c.auth; if (_a) { auth = { id: _a.id, role: String(_a.get('role') || 'user'), family_id: String(_a.get('family_id') || ''), fromToken: false }; } }
    if (!auth) return c.json(401, { error: 'Unauthorized' });

    var allRecords = $app.findRecordsByFilter('api_tokens', '', '', 10000, 0);
    var result = [];
    for (var i = 0; i < allRecords.length; i++) {
      var r = allRecords[i];
      var ownerId = String(r.get('user') || '');
      if (auth.role !== 'admin' && auth.role !== 'owner') {
        if (ownerId !== auth.id) continue;
      } else if (auth.family_id) {
        var owner = null; try { owner = $app.findRecordById('users', ownerId); } catch(e) {}
        if (!owner || String(owner.get('family_id') || '') !== auth.family_id) continue;
      }
      result.push({
        id: r.id,
        name: String(r.get('name') || ''),
        token_hash: String(r.get('token_hash') || '').substring(0, 12) + '...',
        permissions: r.get('permissions') || r.get('scopes') || [],
        enabled: r.get('enabled') !== false && r.get('enabled') !== 0 && r.get('enabled') !== 'false',
        expires_at: String(r.get('expires_at') || ''),
        user: String(r.get('user') || ''),
        created: r.get('created'),
      });
    }
    return c.json(200, result);
  } catch(e) { return respondError(c, e, 500); }
});

// ─── CREATE token (POST) ───────────────────────────────────────────────────
routerAdd('POST', '/api/api-tokens', (c) => {
  var authLib = require(__hooks + '/lib/auth.js');
  var _bam = authLib.bearerAuthMiddleware;

function _gt(len) { if(typeof len==='undefined')len=48; return 'tl_'+$security.randomString(len); }
  function _ht(tok) { return $security.sha256(tok); }
  try {
    var ba = _bam(c);
    if (ba) return ba;

    var _ti = c.get('apiTokenInfo');
    var auth = null;
    if (_ti) { auth = { id: _ti.user_id, role: _ti.user_role, family_id: String(_ti.family_id || ''), fromToken: true }; } else { var _i = c.requestInfo(); var _a = _i.auth || c.auth; if (_a) { auth = { id: _a.id, role: String(_a.get('role') || 'user'), family_id: String(_a.get('family_id') || ''), fromToken: false }; } }
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    if (auth.fromToken) return c.json(403, { error: 'API tokens cannot create API tokens' });

    var info = c.requestInfo();
    var body = info.body || {};

    var name = String(body.name || '').trim();
    if (!name) return c.json(400, { error: 'name is required' });

    var rawPerms = body.permissions;
    if (!rawPerms || !Array.isArray(rawPerms) || rawPerms.length === 0) {
      return c.json(400, { error: 'permissions array is required' });
    }

    // Validate permissions
    var validPerms = ['tasks:read','tasks:write','tasks:delete','groceries:read','groceries:write','groceries:delete','calendar:read','calendar:write','tasks:*','groceries:*','calendar:*','*'];
    for (var pi = 0; pi < rawPerms.length; pi++) {
      var perm = String(rawPerms[pi] || '');
      var valid = false;
      for (var vpi = 0; vpi < validPerms.length; vpi++) {
        if (perm === validPerms[vpi]) { valid = true; break; }
      }
      if (!valid) {
        var pParts = perm.split(':');
        if (pParts.length === 2 && pParts[1] === '*') { valid = true; }
      }
      if (!valid) return c.json(400, { error: 'Invalid permission: ' + perm });
      if ((perm === '*' || perm.indexOf(':*') > 0) && auth.role !== 'admin' && auth.role !== 'owner') return c.json(403, { error: 'Admin only permission: ' + perm });
    }

    var rawToken = _gt(48);
    var hashed = _ht(rawToken);

    var coll = $app.findCollectionByNameOrId('api_tokens');
    var rec = new Record(coll);
    rec.set('name', name);
    rec.set('token_hash', hashed);
    rec.set('permissions', rawPerms);
    rec.set('user', auth.id);
    try { rec.set('enabled', true); } catch(e) {}
    try { rec.set('token_type', 'personal_api_token'); } catch(e) {}
    if (body.expires_at) { try { rec.set('expires_at', body.expires_at); } catch(e) {} }
    $app.save(rec);

    return c.json(201, {
      id: rec.id, name: name, token: rawToken,
      permissions: rawPerms, enabled: true, token_type: 'personal_api_token',
      expires_at: body.expires_at || null, user: auth.id,
      created: new Date().toISOString(),
      message: 'Save this token — it will not be shown again.',
    });
  } catch(e) { return respondError(c, e, 500); }
});

// ─── DELETE token (DELETE) ─────────────────────────────────────────────────
routerAdd('DELETE', '/api/api-tokens/{id}', (c) => {
  var authLib = require(__hooks + '/lib/auth.js');
  var _bam = authLib.bearerAuthMiddleware;

try {
    var ba = _bam(c);
    if (ba) return ba;

    var _ti = c.get('apiTokenInfo');
    var auth = null;
    if (_ti) { auth = { id: _ti.user_id, role: _ti.user_role, family_id: String(_ti.family_id || ''), fromToken: true }; } else { var _i = c.requestInfo(); var _a = _i.auth || c.auth; if (_a) { auth = { id: _a.id, role: String(_a.get('role') || 'user'), family_id: String(_a.get('family_id') || ''), fromToken: false }; } }
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    if (auth.fromToken) return c.json(403, { error: 'API tokens cannot manage API tokens' });

    var tokenId = c.request.pathValue('id');
    if (!tokenId) return c.json(400, { error: 'Token ID is required' });

    var token = $app.findRecordById('api_tokens', tokenId);
    if (!token) return c.json(404, { error: 'Token not found' });
    var ownerId = String(token.get('user') || '');
    if (auth.role !== 'admin' && auth.role !== 'owner') {
      if (ownerId !== auth.id) return c.json(403, { error: 'Cannot manage another user token' });
    } else if (auth.family_id) {
      var owner = null; try { owner = $app.findRecordById('users', ownerId); } catch(e) {}
      if (!owner || String(owner.get('family_id') || '') !== auth.family_id) return c.json(403, { error: 'Token is outside your family' });
    }

    $app.delete(token);
    return c.json(200, { deleted: true, id: tokenId });
  } catch(e) { return respondError(c, e, 500); }
});

// ─── TOGGLE token enable/disable (PATCH) ───────────────────────────────────
routerAdd('PATCH', '/api/api-tokens/{id}/toggle', (c) => {
  var authLib = require(__hooks + '/lib/auth.js');
  var _bam = authLib.bearerAuthMiddleware;

try {
    var ba = _bam(c);
    if (ba) return ba;

    var _ti = c.get('apiTokenInfo');
    var auth = null;
    if (_ti) { auth = { id: _ti.user_id, role: _ti.user_role, family_id: String(_ti.family_id || ''), fromToken: true }; } else { var _i = c.requestInfo(); var _a = _i.auth || c.auth; if (_a) { auth = { id: _a.id, role: String(_a.get('role') || 'user'), family_id: String(_a.get('family_id') || ''), fromToken: false }; } }
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    if (auth.fromToken) return c.json(403, { error: 'API tokens cannot manage API tokens' });

    var tokenId = c.request.pathValue('id');
    if (!tokenId) return c.json(400, { error: 'Token ID is required' });

    var token = $app.findRecordById('api_tokens', tokenId);
    if (!token) return c.json(404, { error: 'Token not found' });
    var ownerId = String(token.get('user') || '');
    if (auth.role !== 'admin' && auth.role !== 'owner') {
      if (ownerId !== auth.id) return c.json(403, { error: 'Cannot manage another user token' });
    } else if (auth.family_id) {
      var owner = null; try { owner = $app.findRecordById('users', ownerId); } catch(e) {}
      if (!owner || String(owner.get('family_id') || '') !== auth.family_id) return c.json(403, { error: 'Token is outside your family' });
    }

    var current = token.get('enabled');
    var newVal = (current === false || current === 0 || current === 'false') ? true : false;
    token.set('enabled', newVal);
    $app.save(token);

    return c.json(200, {
      id: tokenId,
      enabled: newVal,
      message: newVal ? 'Token enabled' : 'Token disabled',
    });
  } catch(e) { return respondError(c, e, 500); }
});
