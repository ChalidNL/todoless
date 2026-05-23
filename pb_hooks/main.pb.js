/// <reference path="../pb_data/types.d.ts" />

// PB 0.34 JS hooks: 
// - function/var declarations don't hoist into callbacks — inline helpers per handler
// - c.requestInfo() call ONCE per request
// - use info.body NOT info.data (PB 0.34 compat)
// - $app.save(rec) for users throws "ReferenceError: tasks" (PB 0.34.2 bug)
//   FIX: use var u = $app.unsafeWithoutHooks(); u.save(rec); with manual id/tokenKey

// ── Record Hooks: task subtask_ids ──
onRecordCreate('tasks', (e) => {
  try {
    var data = e.requestInfo && e.requestInfo().data ? e.requestInfo().data : {};
    if (data && data.subtask_ids !== undefined) {
      e.record.set('subtask_ids', data.subtask_ids);
    }
  } catch(err) { /* ignore - e.requestInfo may not exist in all contexts */ }
});

onRecordUpdate('tasks', (e) => {
  try {
    var data = e.requestInfo && e.requestInfo().data ? e.requestInfo().data : {};
    if (data && data.subtask_ids !== undefined) {
      e.record.set('subtask_ids', data.subtask_ids);
    }
  } catch(err) { /* ignore */ }
});
// Note: onRecordEnrich used — subtask_ids default rendering uses GET with ?expand=subtask_ids&subtasks=1
// rendering uses GET with ?expand=subtask_ids&subtasks=1

// ─── Public API endpoints ────────────────────────────────────────────────

routerAdd('GET', '/api/hook-health', (c) => c.json(200, { ok: true }));

// ─── Routes loaded from pb_hooks/routes/ ──
// Note: routes/openapi.js registers GET /api/openapi.json (inline spec)
// Note: routes/docs.js registers GET /api/docs + /api/swagger (Swagger UI HTML)
// Note: routes/api-tokens.js registers CRUD for API tokens

// ── Debug: test token generation (no auth required) ──
routerAdd('GET', '/api/debug-token', (c) => {
  try {
    function _gt(len) { if(typeof len==='undefined')len=48;var c='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',r='';for(var i=0;i<len;i++){r+=c.charAt(Math.floor(Math.random()*c.length));}return 'tl_'+r; }
    function _ht(tok) { try { return $security.SHA256(tok); } catch(e){ var h=0;if(tok.length===0)return'd';for(var i=0;i<tok.length;i++){h=((h<<5)-h)+tok.charCodeAt(i);h=h&h;}return 'd_'+Math.abs(h).toString(16).padStart(8,'0');} }
    var t = _gt(48);
    var h = _ht(t);
    return c.json(200, { token: t.substring(0,12) + '...', hash: h, ok: true });
  } catch(e) {
    return c.json(500, { error: String(e) });
  }
});

// ── Debug: test agent invite (no auth, fixed user ID) ──
routerAdd('POST', '/api/debug-agent-invite', (c) => {
  try {
    function _gt(len) { if(typeof len==='undefined')len=48;var c='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',r='';for(var i=0;i<len;i++){r+=c.charAt(Math.floor(Math.random()*c.length));}return 'tl_'+r; }
    function _ht(tok) { try { return $security.SHA256(tok); } catch(e){ var h=0;if(tok.length===0)return'd';for(var i=0;i<tok.length;i++){h=((h<<5)-h)+tok.charCodeAt(i);h=h&h;}return 'd_'+Math.abs(h).toString(16).padStart(8,'0');} }
    
    var code = '';
    var digits = '0123456789';
    for (var i = 0; i < 6; i++) { code += digits.charAt(Math.floor(Math.random() * digits.length)); }
    var now = new Date();
    var expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    var coll = $app.findCollectionByNameOrId('invite_codes');
    var rec = new Record(coll);
    rec.set('code', code);
    rec.set('expires_at', expiresAt.toISOString());
    rec.set('used', false);
    rec.set('user', 'zqjmvcm0g5wznm7');
    rec.set('type', 'agent');
    var rawToken = _gt(48);
    var hashed = _ht(rawToken);
    var tokenColl = $app.findCollectionByNameOrId('api_tokens');
    var tokenRec = new Record(tokenColl);
    tokenRec.set('name', 'Agent: ' + code);
    tokenRec.set('token_hash', hashed);
    tokenRec.set('permissions', ['*']);
    tokenRec.set('enabled', true);
    tokenRec.set('user', 'zqjmvcm0g5wznm7');
    try { tokenRec.set('token_type', 'agent_api_token'); } catch(e) {}
    $app.save(tokenRec);
    rec.set('token_id', tokenRec.id);
    $app.save(rec);
    return c.json(201, { id: rec.id, code: code, token: rawToken, token_id: tokenRec.id, type: 'agent', expires_at: expiresAt.toISOString() });
  } catch(e) {
    return c.json(500, { error: String(e), stack: String(e.stack||'') });
  }
});

// ── Create invite code (server-side, bypasses PB API rules) ──
// Supports type: 'human' (default) or 'agent'
// If type='agent': also generates an API token (enabled=false), stored hashed, returned once.
routerAdd('POST', '/api/invites/create', (c) => {
  try {
    var info = c.requestInfo();
    console.log('INVITE_CREATE: type=' + String((info.body||{}).type) + ' body=' + JSON.stringify(info.body||{}));
    var auth = info && info.auth ? info.auth : null;
    if (!auth) return c.json(401, { error: 'Unauthorized' });

    var body = info.body || {};
    var type = String(body.type || 'human').trim();
    if (type !== 'human' && type !== 'agent') {
      return c.json(400, { error: 'type must be \"human\" or \"agent\"' });
    }

    // Generate 6-digit code
    var code = '';
    var digits = '0123456789';
    for (var i = 0; i < 6; i++) {
      code += digits.charAt(Math.floor(Math.random() * digits.length));
    }

    var now = new Date();
    var expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    var coll = $app.findCollectionByNameOrId('invite_codes');
    var rec = new Record(coll);
    rec.set('code', code);
    rec.set('expires_at', expiresAt.toISOString());
    rec.set('used', false);
    rec.set('user', auth.id);
    rec.set('type', type);

    var rawToken = null;
    var tokenId = null;

    if (type === 'agent') {
      // Inline helpers (PB 0.34: function decls don't hoist into callbacks)
      function _gt(len) { if(typeof len==='undefined')len=48;var c='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',r='';for(var i=0;i<len;i++){r+=c.charAt(Math.floor(Math.random()*c.length));}return 'tl_'+r; }
      function _ht(tok) { try { return $security.SHA256(tok); } catch(e){ var h=0;if(tok.length===0)return'd';for(var i=0;i<tok.length;i++){h=((h<<5)-h)+tok.charCodeAt(i);h=h&h;}return 'd_'+Math.abs(h).toString(16).padStart(8,'0');} }
      rawToken = _gt(48);
      var hashed = _ht(rawToken);

      var tokenColl = $app.findCollectionByNameOrId('api_tokens');
      var tokenRec = new Record(tokenColl);
      tokenRec.set('name', 'Agent: ' + code);
      tokenRec.set('token_hash', hashed);
      tokenRec.set('permissions', ['*']);
      tokenRec.set('enabled', false);
      tokenRec.set('user', auth.id);
      try { tokenRec.set('token_type', 'agent_api_token'); } catch(e) {}
      $app.save(tokenRec);

      tokenId = tokenRec.id;
      rec.set('token_id', tokenId);
    }

    $app.save(rec);

    var result = {
      id: rec.id,
      code: code,
      created_by: auth.id,
      expires_at: expiresAt.toISOString(),
      used: false,
      type: type,
    };

    if (type === 'agent' && rawToken) {
      result.token = rawToken;
      result.token_id = tokenId;
      result.message_token = 'Save this token — it will not be shown again.';
    }

    return c.json(201, result);
  } catch (e) {
    return c.json(500, { error: String(e) });
  }
});

routerAdd('GET', '/api/setup-status', (c) => {
  try {
    var u = $app.findRecordsByFilter('users', '', '-created', 1, 0);
    var s = $app.findRecordsByFilter('app_settings', 'setup_complete = true', '-created', 1, 0);
    return c.json(200, { has_users: u.length > 0, setup_complete: s.length > 0 });
  } catch(e) { return c.json(200, { has_users: false, setup_complete: false }); }
});

// ── Validate invite code (no auth required, public) ──
routerAdd('GET', '/api/validate-invite', (c) => {
  try {
    var q = c.requestInfo().query || {};
    var code = String(q.code || '').trim().toUpperCase();
    if (!code) return c.json(400, { status: 'error', message: 'code required' });

    var now = new Date().toISOString();
    var invites = $app.findRecordsByFilter('invite_codes', 'code = "' + code + '" && used = false && expires_at > "' + now + '"', '-created', 1, 0);

    if (invites.length === 0) {
      return c.json(200, { valid: false, status: 'invalid_or_expired' });
    }

    var inviter = $app.findRecordById('users', String(invites[0].get('user') || ''));
    var familyName = '';
    if (inviter) {
      var fid = String(inviter.get('family_id') || '');
      if (fid) {
        var family = $app.findRecordById('families', fid);
        if (family) familyName = String(family.get('name') || '');
      }
    }

    return c.json(200, {
      valid: true,
      status: 'valid',
      family_id: inviter ? String(inviter.get('family_id') || '') : '',
      family_name: familyName,
      invited_by: inviter ? String(inviter.get('name') || inviter.get('email') || '') : ''
    });
  } catch(e) { return c.json(500, { error: String(e) }); }
});

// ── User registration (no auth required) ──
routerAdd('POST', '/api/register', (c) => {
  // Inline helper: create user with hooks bypass (PB 0.34 bug workaround)
  var createUser = function(col, data) {
    var u = $app.unsafeWithoutHooks();
    var rec = new Record(col);
    rec.set('id', $security.randomString(15));
    rec.set('tokenKey', $security.randomString(30));
    rec.set('verified', false);
    rec.set('email', data.email);
    rec.set('password', data.password);
    rec.set('passwordConfirm', data.passwordConfirm || data.password);
    rec.set('name', data.name || '');
    rec.set('emailVisibility', true);
    rec.set('role', data.role || 'user');
    rec.set('family_id', data.family_id || '');
    u.save(rec);
    return rec;
  };

  var createFamily = function(name, createdBy) {
    var fc = $app.findCollectionByNameOrId('families');
    var fam = new Record(fc);
    fam.set('id', $security.randomString(15));
    fam.set('tokenKey', $security.randomString(30));
    fam.set('name', name || 'My Family');
    fam.set('created_by', createdBy);
    var u = $app.unsafeWithoutHooks();
    u.save(fam);
    return fam;
  };

  try {
    var info = c.requestInfo();
    var d = info.body || {};
    var userType = String(d.user_type || 'family_member').trim();
    if (['family_member', 'family_assistant'].indexOf(userType) === -1) {
      return c.json(400, { error: 'Invalid user_type. Must be family_member or family_assistant.' });
    }

    var existing = $app.findRecordsByFilter('users', '', '-created', 1, 0);
    var setupDone = $app.findRecordsByFilter('app_settings', 'setup_complete = true', '-created', 1, 0).length > 0;
    if (existing.length === 0 || !setupDone) {
      // ── First user / setup flow ──
      if (!d.email || !d.password || d.password.length < 8) return c.json(400, { error: 'Email and password (min 8) required' });
      if (d.password !== d.passwordConfirm) return c.json(400, { error: 'Passwords do not match' });

      var uc = $app.findCollectionByNameOrId('users');
      var rec = createUser(uc, {
        email: d.email,
        password: d.password,
        passwordConfirm: d.passwordConfirm,
        name: d.name || d.email.split('@')[0],
        role: 'admin',
        family_id: ''
      });

      var fam = createFamily(d.family_name || 'My Family', rec.id);

      // Update user with family_id
      rec.set('family_id', fam.id);
      var u = $app.unsafeWithoutHooks();
      u.save(rec);

      return c.json(201, {
        user: { id: rec.id, email: String(rec.get('email')||''), name: String(rec.get('name')||''), role: 'admin', family_id: fam.id }
      });
    }

    // ── Invite-based registration ──
    var ic = String(d.invite_code || '').trim().toUpperCase();
    if (!ic) throw new BadRequestError('Invite code required for registration.', {});
    var now = new Date().toISOString();
    var invites = $app.findRecordsByFilter('invite_codes', 'code="' + ic + '"&&used=false&&expires_at>"' + now + '"', '-created', 1, 0);
    if (invites.length === 0) throw new BadRequestError('Invalid or expired invite code.', {});
    var inviter = $app.findRecordById('users', String(invites[0].get('user') || ''));
    var fid = inviter ? String(inviter.get('family_id') || '') : '';
    if (!fid) throw new BadRequestError('Inviter has no family — ask admin to create one.', {});

    var role = 'member';
    var uc = $app.findCollectionByNameOrId('users');
    var rec = createUser(uc, {
      email: d.email,
      password: d.password,
      passwordConfirm: d.passwordConfirm,
      name: d.name || d.email.split('@')[0],
      role: role,
      family_id: fid
    });

    // Mark invite as used
    var inviteRec = invites[0];
    inviteRec.set('used', true);
    inviteRec.set('used_at', now);
    inviteRec.set('used_by', rec.id);
    var uu = $app.unsafeWithoutHooks();
    uu.save(inviteRec);

    return c.json(201, {
      user: { id: rec.id, email: String(rec.get('email')||''), name: String(rec.get('name')||''), role: role, family_id: fid }
    });
  } catch(e) { return c.json(400, { error: String(e), stack: String(e.stack||'') }); }
});

// ── Entries: LIST (GET) ──
routerAdd('GET', '/api/entries', (c) => {
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
      var hashed = (function(tok) { try { return $security.SHA256(tok); } catch(e) { var h=0;if(tok.length===0)return'd';for(var i=0;i<tok.length;i++){h=((h<<5)-h)+tok.charCodeAt(i);h=h&h;}return'd_'+Math.abs(h).toString(16).padStart(8,'0');} })(token);
      var tokens = $app.findRecordsByFilter('api_tokens','token_hash = "'+hashed+'"','',1,0);
      if (tokens.length === 0) return null;
      var tokRec = tokens[0];
      var rawEnabled = tokRec.get('enabled');
      if (rawEnabled === false || rawEnabled === 0 || rawEnabled === 'false') return c.json(401,{'error':'API token is disabled'});
      var rawExp = tokRec.get('expires_at');
      if (rawExp) { var expMs=0;if(typeof rawExp==='string')expMs=new Date(rawExp).getTime();else if(rawExp&&typeof rawExp.getTime==='function')expMs=rawExp.getTime();else if(rawExp)expMs=new Date(String(rawExp)).getTime();var nowMs=new Date().getTime();if(expMs>0&&expMs<nowMs)return c.json(401,{'error':'API token has expired'}); }
      var userId = String(tokRec.get('user')||'');
      var user = null; try { user = $app.findRecordById('users',userId); } catch(e) { return c.json(401,{'error':'Token owner not found'}); }
      if (!user) return c.json(401,{'error':'Token owner not found'});
      var rawActive = user.get('active');
      var rawMemberStatus = user.get('member_status');
      if (rawActive === false || rawActive === 0 || rawActive === 'false') return c.json(403,{'error':'Token owner account is blocked'});
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
    var ba = bearerAuthMiddleware(c);
    if (ba) return ba;
    var info = c.requestInfo();
    var auth = info && info.auth ? info.auth : null;
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    var q = info.query || {};
    var fid = String(auth.get('family_id') || '').trim();
    var f = fid ? 'user.family_id = "' + fid + '"' : 'user = "' + auth.id + '"';
    var tasks = $app.findRecordsByFilter('tasks', f, '-created', 0, 0).map(function(r) {
      return { id:r.id, type:'task', title: (r.get('title')||''), description: (r.get('blocked_comment')||''), status: (r.get('status')||'todo'), assignee_id: (r.get('assigned_to')||''), labels: (r.get('labels')||[]), shop_id:'', quantity:null, created_by: (r.get('user')||''), completed_by:'', created_at: r.get("created"), updated_at: r.get("updated") };
    });
    var items = $app.findRecordsByFilter('items', f, '-created', 0, 0).map(function(r) {
      return { id:r.id, type:'grocery', title: (r.get('title')||''), description:'', status: r.get('completed')?'done':'todo', assignee_id: (r.get('assigned_to')||''), labels: (r.get('labels')||[]), shop_id: (r.get('shop_id')||''), quantity: (r.get('quantity')||1), created_by: (r.get('user')||''), completed_by:'', created_at: r.get("created"), updated_at: r.get("updated") };
    });
    var all = tasks.concat(items);
    var t = (q.type||'').trim(), s = (q.status||'').trim(), a = (q.assignee_id||'').trim(), l = (q.label||'').trim(), sh = (q.shop_id||'').trim();
    var res = [];
    for (var i=0;i<all.length;i++) { var e=all[i];
      if (t && e.type!==t) continue; if (s && e.status!==s) continue; if (a && e.assignee_id!==a) continue;
      if (l && (!Array.isArray(e.labels) || e.labels.indexOf(l)===-1)) continue; if (sh && e.shop_id!==sh) continue;
      res.push(e);
    }
    return c.json(200, res);
  } catch(e) { return c.json(400, { error: String(e) }); }
});

// ── API v2: POST /api/v1 (unified action dispatcher) ──
routerAdd('POST', '/api/v1', (c) => {
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
      var hashed = (function(tok) { try { return $security.SHA256(tok); } catch(e) { var h=0;if(tok.length===0)return'd';for(var i=0;i<tok.length;i++){h=((h<<5)-h)+tok.charCodeAt(i);h=h&h;}return'd_'+Math.abs(h).toString(16).padStart(8,'0');} })(token);
      var tokens = $app.findRecordsByFilter('api_tokens','token_hash = "'+hashed+'"','',1,0);
      if (tokens.length === 0) return null;
      var tokRec = tokens[0];
      var rawEnabled = tokRec.get('enabled');
      if (rawEnabled === false || rawEnabled === 0 || rawEnabled === 'false') return c.json(401,{'error':'API token is disabled'});
      var rawExp = tokRec.get('expires_at');
      if (rawExp) { var expMs=0;if(typeof rawExp==='string')expMs=new Date(rawExp).getTime();else if(rawExp&&typeof rawExp.getTime==='function')expMs=rawExp.getTime();else if(rawExp)expMs=new Date(String(rawExp)).getTime();var nowMs=new Date().getTime();if(expMs>0&&expMs<nowMs)return c.json(401,{'error':'API token has expired'}); }
      var userId = String(tokRec.get('user')||'');
      var user = null; try { user = $app.findRecordById('users',userId); } catch(e) { return c.json(401,{'error':'Token owner not found'}); }
      if (!user) return c.json(401,{'error':'Token owner not found'});
      var rawActive = user.get('active');
      var rawMemberStatus = user.get('member_status');
      if (rawActive === false || rawActive === 0 || rawActive === 'false') return c.json(403,{'error':'Token owner account is blocked'});
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
    var ba = bearerAuthMiddleware(c);
    if (ba) return ba;
    var info = c.requestInfo();
    var body = info.body || {};
    var d = body;
    var action = (d.action || '').trim();
    if (!action) return c.json(400, { error: 'action required' });
    var auth = null;

    var needsAuth = ['create','update','complete','assign','delete','list','filters','add_subtask'];
    if (needsAuth.indexOf(action) >= 0) {
      auth = info.auth || c.get('authRecord');
      if (!auth) return c.json(401, { error: 'Unauthorized' });
    }

    var gv = function(o,k,f) { if(f===undefined)f='';if(!o)return f;if(Object.prototype.hasOwnProperty.call(o,k)){var v=o[k];return(v===undefined||v===null)?f:v;}return f; };

    if (action === 'list') {
      var q = info.query || {};
      var fid = String(auth.get('family_id') || '').trim();
      var f = fid ? 'user.family_id = "' + fid + '"' : 'user = "' + auth.id + '"';
      var tasks = $app.findRecordsByFilter('tasks', f, '-created', 0, 0).map(function(r) {
        return { id:r.id, type:'task', title:(r.get('title')||''), description:(r.get('blocked_comment')||''), status:(r.get('status')||'todo'), assignee_id:(r.get('assigned_to')||''), labels:(r.get('labels')||[]), shop_id:'', quantity:null, created_by:(r.get('user')||''), completed_by:'', created_at:r.get("created"), updated_at:r.get("updated") };
      });
      var items = $app.findRecordsByFilter('items', f, '-created', 0, 0).map(function(r) {
        return { id:r.id, type:'grocery', title:(r.get('title')||''), description:'', status:r.get('completed')?'done':'todo', assignee_id:(r.get('assigned_to')||''), labels:(r.get('labels')||[]), shop_id:(r.get('shop_id')||''), quantity:(r.get('quantity')||1), created_by:(r.get('user')||''), completed_by:'', created_at:r.get("created"), updated_at:r.get("updated") };
      });
      var all = tasks.concat(items);
      var t = (q.type||'').trim(), s = (q.status||'').trim(), a2 = (q.assignee_id||'').trim(), l = (q.label||'').trim(), sh = (q.shop_id||'').trim();
      var res = [];
      for (var i=0;i<all.length;i++) { var e=all[i];
        if (t && e.type!==t) continue; if (s && e.status!==s) continue; if (a2 && e.assignee_id!==a2) continue;
        if (l && (!Array.isArray(e.labels) || e.labels.indexOf(l)===-1)) continue; if (sh && e.shop_id!==sh) continue;
        res.push(e);
      }
      return c.json(200, res);
    }

    if (action === 'create') {
      var title = String(gv(d,'title','')).trim();
      var type = String(gv(d,'type','task')).trim();
      if (!title) return c.json(400, { error: 'title required' });
      var fid = String(auth.get('family_id') || '').trim();

      if (type === 'task') {
        var rec = new Record($app.findCollectionByNameOrId('tasks'));
        rec.set('title', title);
        rec.set('user', auth.id);
        if (fid) rec.set('family_id', fid);
        var s2 = String(gv(d,'status','todo')).trim();
        if (s2) rec.set('status', s2);
        var desc = String(gv(d,'description','')).trim();
        if (desc) rec.set('blocked_comment', desc);
        var assign = String(gv(d,'assignee_id','')).trim();
        if (assign) rec.set('assigned_to', assign);
        var labs = d.labels;
        if (Array.isArray(labs) && labs.length > 0) rec.set('labels', labs);
        var linkedTo = String(gv(d,'linked_to','')).trim();
        if (linkedTo) rec.set('linked_to', linkedTo);
        var linkedType = String(gv(d,'linked_type','')).trim();
        if (linkedType) rec.set('linked_type', linkedType);
        rec.set('flag',false);
        $app.save(rec);

        // If this is a subtask (has linked_to), update parent's subtask_ids
        if (linkedTo) {
          var parent = $app.findRecordById('tasks', linkedTo);
          if (parent) {
            var existing = parent.get('subtask_ids') || [];
            if (Array.isArray(existing) && existing.indexOf(rec.id) === -1) {
              existing.push(rec.id);
              parent.set('subtask_ids', existing);
              $app.save(parent);
            }
          }
        }

        return c.json(201, {id:rec.id,type:'task',title:rec.get('title'),description:rec.get('blocked_comment'),status:rec.get('status'),assignee_id:rec.get('assigned_to'),labels:rec.get('labels'),shop_id:'',quantity:null,created_by:auth.id,completed_by:'',created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
      }

      if (type === 'grocery') {
        rec = new Record($app.findCollectionByNameOrId('items'));
        rec.set('title', title);
        rec.set('user', auth.id);
        if (fid) rec.set('family_id', fid);
        var qty = Number(gv(d,'quantity','1'));
        if (!isNaN(qty) && qty > 0) rec.set('quantity', qty);
        var shop = String(gv(d,'shop_id','')).trim();
        if (shop) rec.set('shop_id', shop);
        var assign2 = String(gv(d,'assignee_id','')).trim();
        if (assign2) rec.set('assigned_to', assign2);
        rec.set('completed', false);
        $app.save(rec);
        return c.json(201, {id:rec.id,type:'grocery',title:rec.get('title'),description:'',status:rec.get('completed')?'done':'todo',assignee_id:rec.get('assigned_to'),labels:rec.get('labels'),shop_id:rec.get('shop_id'),quantity:rec.get('quantity'),created_by:auth.id,completed_by:'',created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
      }

      return c.json(400, { error: 'Invalid type: ' + type });
    }

    if (action === 'complete') {
      var id = String(gv(d,'id','')).trim();
      var type = String(gv(d,'type','')).trim();
      if(!id) return c.json(400,{error:'id required'});
      if(!type||(type!=='task'&&type!=='grocery')) return c.json(400,{error:'type must be task or grocery'});
      var rec = $app.findRecordById(type==='task'?'tasks':'items',id);
      if(!rec) return c.json(404,{error:'Entry not found'});
      if(type==='task'){ rec.set('status','done'); } else { rec.set('completed',true); }
      $app.save(rec);return c.json(200,{completed:true});
    }

    if (action === 'assign') {
      var id = String(gv(d,'id','')).trim();
      var type = String(gv(d,'type','')).trim();
      if(!id) return c.json(400,{error:'id required'});
      if(!type||(type!=='task'&&type!=='grocery')) return c.json(400,{error:'type must be task or grocery'});
      var rec = $app.findRecordById(type==='task'?'tasks':'items',id);
      if(!rec) return c.json(404,{error:'Entry not found'});
      rec.set('assigned_to',String(gv(d,'assignee_id','')));
      $app.save(rec);return c.json(200,{assigned:true});
    }

    if (action === 'delete') {
      var id = String(gv(d,'id','')).trim();
      var type = String(gv(d,'type','')).trim();
      if(!id) return c.json(400,{error:'id required'});
      if(!type||(type!=='task'&&type!=='grocery')) return c.json(400,{error:'type must be task or grocery'});
      var rec = $app.findRecordById(type==='task'?'tasks':'items',id);
      if(!rec) return c.json(404,{error:'Entry not found'});
      $app.delete(rec);return c.json(200,{deleted:true});
    }

    if (action === 'add_subtask') {
      if (!auth) return c.json(401, { error: 'Unauthorized' });
      var taskId = String(gv(d, 'task_id', '')).trim();
      var subtaskId = String(gv(d, 'subtask_id', '')).trim();
      if (!taskId || !subtaskId) return c.json(400, { error: 'task_id and subtask_id required' });
      var parent = $app.findRecordById('tasks', taskId);
      if (!parent) return c.json(404, { error: 'Parent task not found' });
      var existing = parent.get('subtask_ids') || [];
      if (!Array.isArray(existing)) existing = [];
      if (existing.indexOf(subtaskId) === -1) {
        existing.push(subtaskId);
        parent.set('subtask_ids', existing);
        $app.save(parent);
      }
      return c.json(200, { success: true });
    }

    if (action === 'filters') {
      var fid = String(auth.get('family_id')||'').trim();
      var f = fid?'user.family_id = "'+fid+'"':'user = "'+auth.id+'"';
      var labels = $app.findRecordsByFilter('labels',f,'name',0,0).map(function(r){return{id:r.id,name:r.get('name'),color:r.get('color')};});
      var shops = $app.findRecordsByFilter('shops',f,'name',0,0).map(function(r){return{id:r.id,name:r.get('name'),color:r.get('color')};});
      var users = [];
      if(fid){users=$app.findRecordsByFilter('users','family_id = "'+fid+'"','name',0,0).map(function(r){return{id:r.id,name:r.get('name')||r.email};});}
      return c.json(200,{labels:labels,shops:shops,users:users});
    }

    // ── Admin: set_role (max 1 admin) ──
    if (action === 'set_role') {
      if (!auth) return c.json(401, { error: 'Unauthorized' });
      if (String(auth.get('role') || '') !== 'admin' && String(auth.get('role') || '') !== 'owner') return c.json(403, { error: 'Admin only' });
      var targetId = String(gv(d, 'user_id', '')).trim();
      var newRole = String(gv(d, 'role', '')).trim();
      if (!targetId || !newRole) return c.json(400, { error: 'user_id and role required' });
      if (['owner','admin','member','agent'].indexOf(newRole) === -1) return c.json(400, { error: 'Invalid role' });

      // Max 1 admin: demote current admin before promoting another
      if (newRole === 'admin') {
        var existingAdmins = $app.findRecordsByFilter('users', 'role = "admin"', '', 0, 0);
        var filtered = [];
        for (var i = 0; i < existingAdmins.length; i++) {
          if (existingAdmins[i].id !== targetId) filtered.push(existingAdmins[i]);
        }
        if (filtered.length > 0) return c.json(400, { error: 'There can be only one admin. Demote the current admin first.' });
      }

      // Prevent current user from demoting themselves from admin if no other admin exists
      if (newRole !== 'admin' && auth.id === targetId) {
        var remainingAdmins = $app.findRecordsByFilter('users', 'role = "admin"', '', 0, 0);
        var otherAdmins = [];
        for (var i = 0; i < remainingAdmins.length; i++) {
          if (remainingAdmins[i].id !== targetId) otherAdmins.push(remainingAdmins[i]);
        }
        if (otherAdmins.length === 0) return c.json(400, { error: 'You are the only admin. Promote someone else first.' });
      }

      var target = $app.findRecordById('users', targetId);
      if (!target) return c.json(404, { error: 'User not found' });
      var u = $app.unsafeWithoutHooks();
      target.set('role', newRole);
      u.save(target);
      return c.json(200, { success: true, user_id: targetId, role: newRole });
    }

    return c.json(400, { error: 'Unknown action: ' + action });
  } catch(e) { return c.json(400, { error: String(e) }); }
});

// ── Load additional route files ──────────────────────────────────────
// Route files now auto-loaded from 10_openapi.pb.js, 11_docs.pb.js, 12_users.pb.js

// ── Agent management endpoints ──────────────────────────────────────────
// These work with api_tokens records where enabled=false = pending, enabled=true = approved.

// GET /api/agent/counts — returns pending/approved counts
routerAdd('GET', '/api/agent/counts', (c) => {
  try {
    var info = c.requestInfo();
    var auth = info && info.auth ? info.auth : null;
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    if (String(auth.get('role') || '') !== 'admin' && String(auth.get('role') || '') !== 'owner') return c.json(403, { error: 'Admin only' });

    // Get family members to scope tokens
    var fid = String(auth.get('family_id') || '');
    var userIds = [];
    if (fid) {
      var members = $app.findRecordsByFilter('users', 'family_id = "' + fid + '"', '', 0, 0);
      for (var mi = 0; mi < members.length; mi++) { userIds.push('"' + members[mi].id + '"'); }
    } else {
      userIds.push('"' + auth.id + '"');
    }
    var userFilter = 'user.id = ' + userIds.join(' || user.id = ');
    var allTokens = $app.findRecordsByFilter('api_tokens', userFilter, '', 0, 0);
    var pending = 0, approved = 0;
    for (var ti = 0; ti < allTokens.length; ti++) {
      var rawEnabled = allTokens[ti].get('enabled');
      var isEnabled = rawEnabled !== false && rawEnabled !== 0 && rawEnabled !== 'false';
      if (isEnabled) approved++; else pending++;
    }
    return c.json(200, { pending: pending, approved: approved });
  } catch(e) { return c.json(500, { error: String(e) }); }
});

// GET /api/agent/pending — returns tokens where enabled=false
routerAdd('GET', '/api/agent/pending', (c) => {
  try {
    var info = c.requestInfo();
    var auth = info && info.auth ? info.auth : null;
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    if (String(auth.get('role') || '') !== 'admin' && String(auth.get('role') || '') !== 'owner') return c.json(403, { error: 'Admin only' });

    var fid = String(auth.get('family_id') || '');
    var userIds = [];
    if (fid) {
      var members = $app.findRecordsByFilter('users', 'family_id = "' + fid + '"', '', 0, 0);
      for (var mi = 0; mi < members.length; mi++) { userIds.push('"' + members[mi].id + '"'); }
    } else {
      userIds.push('"' + auth.id + '"');
    }
    var userFilter = 'user.id = ' + userIds.join(' || user.id = ');
    var tokens = $app.findRecordsByFilter('api_tokens', userFilter + ' && enabled=false', '-created', 0, 0);
    var agents = [];
    for (var ti = 0; ti < tokens.length; ti++) {
      var t = tokens[ti];
      agents.push({
        id: t.id,
        name: String(t.get('name') || 'Agent'),
        email: '',
        status: 'pending',
        created: t.get('created') || new Date().toISOString(),
      });
    }
    return c.json(200, { agents: agents });
  } catch(e) { return c.json(500, { error: String(e) }); }
});

// POST /api/agent/approve — enables a token
routerAdd('POST', '/api/agent/approve', (c) => {
  try {
    var info = c.requestInfo();
    var auth = info && info.auth ? info.auth : null;
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    if (String(auth.get('role') || '') !== 'admin' && String(auth.get('role') || '') !== 'owner') return c.json(403, { error: 'Admin only' });

    var d = info.body || {};
    var tokenId = String(d.id || '').trim();
    if (!tokenId) return c.json(400, { error: 'id required' });

    var token = $app.findRecordById('api_tokens', tokenId);
    if (!token) return c.json(404, { error: 'Token not found' });
    token.set('enabled', true);
    $app.save(token);

    // Also update the invite's used flag if linked
    var invites = $app.findRecordsByFilter('invite_codes', 'token_id = "' + tokenId + '"', '', 1, 0);
    if (invites.length > 0) {
      var inv = invites[0];
      inv.set('used', true);
      inv.set('used_at', new Date().toISOString());
      $app.save(inv);
    }

    return c.json(200, {
      id: tokenId,
      name: String(token.get('name') || ''),
      status: 'approved',
      message: 'Agent approved. Token is now active.',
    });
  } catch(e) { return c.json(500, { error: String(e) }); }
});

// POST /api/agent/reject — deletes a pending token
routerAdd('POST', '/api/agent/reject', (c) => {
  try {
    var info = c.requestInfo();
    var auth = info && info.auth ? info.auth : null;
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    if (String(auth.get('role') || '') !== 'admin' && String(auth.get('role') || '') !== 'owner') return c.json(403, { error: 'Admin only' });

    var d = info.body || {};
    var tokenId = String(d.id || '').trim();
    if (!tokenId) return c.json(400, { error: 'id required' });

    var token = $app.findRecordById('api_tokens', tokenId);
    if (!token) return c.json(404, { error: 'Token not found' });

    // Also delete linked invite
    var invites = $app.findRecordsByFilter('invite_codes', 'token_id = "' + tokenId + '"', '', 1, 0);
    if (invites.length > 0) {
      $app.delete(invites[0]);
    }

    $app.delete(token);
    return c.json(200, { deleted: true });
  } catch(e) { return c.json(500, { error: String(e) }); }
});

// GET /api/agent/list — returns all tokens with status
routerAdd('GET', '/api/agent/list', (c) => {
  try {
    var info = c.requestInfo();
    var auth = info && info.auth ? info.auth : null;
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    if (String(auth.get('role') || '') !== 'admin' && String(auth.get('role') || '') !== 'owner') return c.json(403, { error: 'Admin only' });

    var fid = String(auth.get('family_id') || '');
    var userIds = [];
    if (fid) {
      var members = $app.findRecordsByFilter('users', 'family_id = "' + fid + '"', '', 0, 0);
      for (var mi = 0; mi < members.length; mi++) { userIds.push('"' + members[mi].id + '"'); }
    } else {
      userIds.push('"' + auth.id + '"');
    }
    var userFilter = 'user.id = ' + userIds.join(' || user.id = ');
    var tokens = $app.findRecordsByFilter('api_tokens', userFilter, '-created', 0, 0);
    var agents = [];
    for (var ti = 0; ti < tokens.length; ti++) {
      var t = tokens[ti];
      var rawEnabled = t.get('enabled');
      var isEnabled = rawEnabled !== false && rawEnabled !== 0 && rawEnabled !== 'false';
      agents.push({
        id: t.id,
        name: String(t.get('name') || 'Agent'),
        email: '',
        status: isEnabled ? 'approved' : 'pending',
        created: t.get('created') || new Date().toISOString(),
        updated: t.get('updated') || '',
      });
    }
    return c.json(200, { agents: agents });
  } catch(e) { return c.json(500, { error: String(e) }); }
});

// DELETE /api/agent/:id — revoke token
routerAdd('DELETE', '/api/agent/:id', (c) => {
  try {
    var info = c.requestInfo();
    var auth = info && info.auth ? info.auth : null;
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    if (String(auth.get('role') || '') !== 'admin' && String(auth.get('role') || '') !== 'owner') return c.json(403, { error: 'Admin only' });

    var tokenId = c.pathParam('id');
    if (!tokenId) return c.json(400, { error: 'id required' });

    var token = $app.findRecordById('api_tokens', tokenId);
    if (!token) return c.json(404, { error: 'Token not found' });
    $app.delete(token);
    return c.json(200, { deleted: true });
  } catch(e) { return c.json(500, { error: String(e) }); }
});
