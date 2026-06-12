// pb_hooks/09_api_tokens.pb.js
// CRUD API for API tokens management (create, list, revoke, toggle).
// Auto-loaded by PB — no require() needed.
// NOTE: PB 0.35.1 Goja runtime means ALL helper functions must be
// defined INSIDE each route callback.

// ─── LIST tokens (GET) ─────────────────────────────────────────────────────
routerAdd('GET', '/api/api-tokens', (c) => {
  function _bam(c) {
    try {
      var authHeader = c.requestInfo().headers['authorization'];
      if (!authHeader) return null;
      var parts = String(authHeader).split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) return c.json(401,{'error':'Invalid Authorization header'});
      var token = parts[1].trim();
      if (!token) return c.json(401,{'error':'Empty token'});
      var hashed = (function(tok){try{return $security.SHA256(tok)}catch(e){var h=0;for(var i=0;i<tok.length;i++){h=((h<<5)-h)+tok.charCodeAt(i);h=h&h;}return'd_'+Math.abs(h).toString(16).padStart(8,'0');}})(token);
      var tokens = $app.findRecordsByFilter('api_tokens','token_hash = "'+hashed+'"','',1,0);
      if (tokens.length === 0) return null;
      var tokRec = tokens[0];
      if (tokRec.get('enabled') === false || tokRec.get('enabled') === 0 || tokRec.get('enabled') === 'false') return c.json(401,{'error':'API token is disabled'});
      var rawExp = tokRec.get('expires_at');
      if (rawExp) { var expMs=0;if(typeof rawExp==='string')expMs=new Date(rawExp).getTime();else if(rawExp&&typeof rawExp.getTime==='function')expMs=rawExp.getTime();else if(rawExp)expMs=new Date(String(rawExp)).getTime();if(expMs>0&&expMs<new Date().getTime())return c.json(401,{'error':'API token has expired'});}
      var userId = String(tokRec.get('user')||'');
      var user = null; try { user = $app.findRecordById('users',userId); } catch(e) { return c.json(401,{'error':'Token owner not found'}); }
      if (!user) return c.json(401,{'error':'Token owner not found'});
      if (user.get('active') === false || user.get('active') === 0 || user.get('active') === 'false') return c.json(403,{'error':'Token owner account is blocked'});
      var rawMemberStatus = user.get('member_status');
      if (rawMemberStatus === 'blocked') return c.json(403,{'error':'Token owner account is blocked'});
      if (rawMemberStatus === 'pending_approval') return c.json(403,{'error':'Token owner is pending approval'});
      var rawPerms = tokRec.get('permissions');
      if (!rawPerms || (Array.isArray(rawPerms)&&rawPerms.length===0)) rawPerms = tokRec.get('scopes');
      var perms = []; if (Array.isArray(rawPerms)) perms=rawPerms; else if (typeof rawPerms==='string') try { perms=JSON.parse(rawPerms); } catch(e){}
      c.set('apiTokenInfo',{token_id:tokRec.id,token_name:String(tokRec.get('name')||''),user_id:user.id,user_role:String(user.get('role')||'user'),user_name:String(user.get('name')||user.get('email')||''),family_id:String(user.get('family_id')||''),permissions:perms});
      c.set('authRecord',user);
      return null;
    } catch(e) { return c.json(500,{'error':'Token auth error: '+String(e)}); }
  }
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
  } catch(e) { return c.json(500, { error: String(e) }); }
});

// ─── CREATE token (POST) ───────────────────────────────────────────────────
routerAdd('POST', '/api/api-tokens', (c) => {
  function _bam(c) {
    try {
      var authHeader = c.requestInfo().headers['authorization'];
      if (!authHeader) return null;
      var parts = String(authHeader).split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) return c.json(401,{'error':'Invalid Authorization header'});
      var token = parts[1].trim();
      if (!token) return c.json(401,{'error':'Empty token'});
      var hashed = (function(tok){try{return $security.SHA256(tok)}catch(e){var h=0;for(var i=0;i<tok.length;i++){h=((h<<5)-h)+tok.charCodeAt(i);h=h&h;}return'd_'+Math.abs(h).toString(16).padStart(8,'0');}})(token);
      var tokens = $app.findRecordsByFilter('api_tokens','token_hash = "'+hashed+'"','',1,0);
      if (tokens.length === 0) return null;
      var tokRec = tokens[0];
      if (tokRec.get('enabled') === false || tokRec.get('enabled') === 0 || tokRec.get('enabled') === 'false') return c.json(401,{'error':'API token is disabled'});
      var rawExp = tokRec.get('expires_at');
      if (rawExp) { var expMs=0;if(typeof rawExp==='string')expMs=new Date(rawExp).getTime();else if(rawExp&&typeof rawExp.getTime==='function')expMs=rawExp.getTime();else if(rawExp)expMs=new Date(String(rawExp)).getTime();if(expMs>0&&expMs<new Date().getTime())return c.json(401,{'error':'API token has expired'});}
      var userId = String(tokRec.get('user')||'');
      var user = null; try { user = $app.findRecordById('users',userId); } catch(e) { return c.json(401,{'error':'Token owner not found'}); }
      if (!user) return c.json(401,{'error':'Token owner not found'});
      if (user.get('active') === false || user.get('active') === 0 || user.get('active') === 'false') return c.json(403,{'error':'Token owner account is blocked'});
      var rawMemberStatus = user.get('member_status');
      if (rawMemberStatus === 'blocked') return c.json(403,{'error':'Token owner account is blocked'});
      if (rawMemberStatus === 'pending_approval') return c.json(403,{'error':'Token owner is pending approval'});
      var rawPerms = tokRec.get('permissions');
      if (!rawPerms || (Array.isArray(rawPerms)&&rawPerms.length===0)) rawPerms = tokRec.get('scopes');
      var perms = []; if (Array.isArray(rawPerms)) perms=rawPerms; else if (typeof rawPerms==='string') try { perms=JSON.parse(rawPerms); } catch(e){}
      c.set('apiTokenInfo',{token_id:tokRec.id,token_name:String(tokRec.get('name')||''),user_id:user.id,user_role:String(user.get('role')||'user'),user_name:String(user.get('name')||user.get('email')||''),family_id:String(user.get('family_id')||''),permissions:perms});
      c.set('authRecord',user);
      return null;
    } catch(e) { return c.json(500,{'error':'Token auth error: '+String(e)}); }
  }
  function _gt(len) { if(typeof len==='undefined')len=48;var c='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',r='';for(var i=0;i<len;i++){r+=c.charAt(Math.floor(Math.random()*c.length));}return'tl_'+r; }
  function _ht(tok) { try { return $security.SHA256(tok); } catch(e) { var h=0;if(tok.length===0)return'd';for(var i=0;i<tok.length;i++){h=((h<<5)-h)+tok.charCodeAt(i);h=h&h;}return'd_'+Math.abs(h).toString(16).padStart(8,'0');} }
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
  } catch(e) { return c.json(500, { error: String(e) }); }
});

// ─── DELETE token (DELETE) ─────────────────────────────────────────────────
routerAdd('DELETE', '/api/api-tokens/:id', (c) => {
  function _bam(c) {
    try {
      var authHeader = c.requestInfo().headers['authorization'];
      if (!authHeader) return null;
      var parts = String(authHeader).split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) return c.json(401,{'error':'Invalid Authorization header'});
      var token = parts[1].trim();
      if (!token) return c.json(401,{'error':'Empty token'});
      var hashed = (function(tok){try{return $security.SHA256(tok)}catch(e){var h=0;for(var i=0;i<tok.length;i++){h=((h<<5)-h)+tok.charCodeAt(i);h=h&h;}return'd_'+Math.abs(h).toString(16).padStart(8,'0');}})(token);
      var tokens = $app.findRecordsByFilter('api_tokens','token_hash = "'+hashed+'"','',1,0);
      if (tokens.length === 0) return null;
      var tokRec = tokens[0];
      if (tokRec.get('enabled') === false || tokRec.get('enabled') === 0 || tokRec.get('enabled') === 'false') return c.json(401,{'error':'API token is disabled'});
      var rawExp = tokRec.get('expires_at');
      if (rawExp) { var expMs=0;if(typeof rawExp==='string')expMs=new Date(rawExp).getTime();else if(rawExp&&typeof rawExp.getTime==='function')expMs=rawExp.getTime();else if(rawExp)expMs=new Date(String(rawExp)).getTime();if(expMs>0&&expMs<new Date().getTime())return c.json(401,{'error':'API token has expired'});}
      var userId = String(tokRec.get('user')||'');
      var user = null; try { user = $app.findRecordById('users',userId); } catch(e) { return c.json(401,{'error':'Token owner not found'}); }
      if (!user) return c.json(401,{'error':'Token owner not found'});
      if (user.get('active') === false || user.get('active') === 0 || user.get('active') === 'false') return c.json(403,{'error':'Token owner account is blocked'});
      var rawMemberStatus = user.get('member_status');
      if (rawMemberStatus === 'blocked') return c.json(403,{'error':'Token owner account is blocked'});
      if (rawMemberStatus === 'pending_approval') return c.json(403,{'error':'Token owner is pending approval'});
      var rawPerms = tokRec.get('permissions');
      if (!rawPerms || (Array.isArray(rawPerms)&&rawPerms.length===0)) rawPerms = tokRec.get('scopes');
      var perms = []; if (Array.isArray(rawPerms)) perms=rawPerms; else if (typeof rawPerms==='string') try { perms=JSON.parse(rawPerms); } catch(e){}
      c.set('apiTokenInfo',{token_id:tokRec.id,token_name:String(tokRec.get('name')||''),user_id:user.id,user_role:String(user.get('role')||'user'),user_name:String(user.get('name')||user.get('email')||''),family_id:String(user.get('family_id')||''),permissions:perms});
      c.set('authRecord',user);
      return null;
    } catch(e) { return c.json(500,{'error':'Token auth error: '+String(e)}); }
  }
  try {
    var ba = _bam(c);
    if (ba) return ba;

    var _ti = c.get('apiTokenInfo');
    var auth = null;
    if (_ti) { auth = { id: _ti.user_id, role: _ti.user_role, family_id: String(_ti.family_id || ''), fromToken: true }; } else { var _i = c.requestInfo(); var _a = _i.auth || c.auth; if (_a) { auth = { id: _a.id, role: String(_a.get('role') || 'user'), family_id: String(_a.get('family_id') || ''), fromToken: false }; } }
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    if (auth.fromToken) return c.json(403, { error: 'API tokens cannot manage API tokens' });

    var tokenId = c.pathParam('id');
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
  } catch(e) { return c.json(500, { error: String(e) }); }
});

// ─── TOGGLE token enable/disable (PATCH) ───────────────────────────────────
routerAdd('PATCH', '/api/api-tokens/:id/toggle', (c) => {
  function _bam(c) {
    try {
      var authHeader = c.requestInfo().headers['authorization'];
      if (!authHeader) return null;
      var parts = String(authHeader).split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) return c.json(401,{'error':'Invalid Authorization header'});
      var token = parts[1].trim();
      if (!token) return c.json(401,{'error':'Empty token'});
      var hashed = (function(tok){try{return $security.SHA256(tok)}catch(e){var h=0;for(var i=0;i<tok.length;i++){h=((h<<5)-h)+tok.charCodeAt(i);h=h&h;}return'd_'+Math.abs(h).toString(16).padStart(8,'0');}})(token);
      var tokens = $app.findRecordsByFilter('api_tokens','token_hash = "'+hashed+'"','',1,0);
      if (tokens.length === 0) return null;
      var tokRec = tokens[0];
      if (tokRec.get('enabled') === false || tokRec.get('enabled') === 0 || tokRec.get('enabled') === 'false') return c.json(401,{'error':'API token is disabled'});
      var rawExp = tokRec.get('expires_at');
      if (rawExp) { var expMs=0;if(typeof rawExp==='string')expMs=new Date(rawExp).getTime();else if(rawExp&&typeof rawExp.getTime==='function')expMs=rawExp.getTime();else if(rawExp)expMs=new Date(String(rawExp)).getTime();if(expMs>0&&expMs<new Date().getTime())return c.json(401,{'error':'API token has expired'});}
      var userId = String(tokRec.get('user')||'');
      var user = null; try { user = $app.findRecordById('users',userId); } catch(e) { return c.json(401,{'error':'Token owner not found'}); }
      if (!user) return c.json(401,{'error':'Token owner not found'});
      if (user.get('active') === false || user.get('active') === 0 || user.get('active') === 'false') return c.json(403,{'error':'Token owner account is blocked'});
      var rawMemberStatus = user.get('member_status');
      if (rawMemberStatus === 'blocked') return c.json(403,{'error':'Token owner account is blocked'});
      if (rawMemberStatus === 'pending_approval') return c.json(403,{'error':'Token owner is pending approval'});
      var rawPerms = tokRec.get('permissions');
      if (!rawPerms || (Array.isArray(rawPerms)&&rawPerms.length===0)) rawPerms = tokRec.get('scopes');
      var perms = []; if (Array.isArray(rawPerms)) perms=rawPerms; else if (typeof rawPerms==='string') try { perms=JSON.parse(rawPerms); } catch(e){}
      c.set('apiTokenInfo',{token_id:tokRec.id,token_name:String(tokRec.get('name')||''),user_id:user.id,user_role:String(user.get('role')||'user'),user_name:String(user.get('name')||user.get('email')||''),family_id:String(user.get('family_id')||''),permissions:perms});
      c.set('authRecord',user);
      return null;
    } catch(e) { return c.json(500,{'error':'Token auth error: '+String(e)}); }
  }
  try {
    var ba = _bam(c);
    if (ba) return ba;

    var _ti = c.get('apiTokenInfo');
    var auth = null;
    if (_ti) { auth = { id: _ti.user_id, role: _ti.user_role, family_id: String(_ti.family_id || ''), fromToken: true }; } else { var _i = c.requestInfo(); var _a = _i.auth || c.auth; if (_a) { auth = { id: _a.id, role: String(_a.get('role') || 'user'), family_id: String(_a.get('family_id') || ''), fromToken: false }; } }
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    if (auth.fromToken) return c.json(403, { error: 'API tokens cannot manage API tokens' });

    var tokenId = c.pathParam('id');
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
  } catch(e) { return c.json(500, { error: String(e) }); }
});
