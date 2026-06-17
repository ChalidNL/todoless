/// <reference path="../pb_data/types.d.ts" />

// PB 0.34 JS hooks: 
// - function/var declarations don't hoist into callbacks — inline helpers per handler
// - c.requestInfo() call ONCE per request
// - use info.body NOT info.data (PB 0.34 compat)
// - $app.save(rec) for users throws "ReferenceError: tasks" (PB 0.34.2 bug)
//   FIX: use var u = $app.unsafeWithoutHooks(); u.save(rec); with manual id/tokenKey



// ── Canonical Record Hooks: single creation path for ALL sources (UI, API, agent) ──

    onRecordCreate('tasks', (e) => {
  var rec = e.record;
  // Canonical defaults - ALWAYS set, no outer try/catch
  if (!rec.get('status')) rec.set('status', 'todo');
  if (rec.get('flag') === undefined || rec.get('flag') === null) rec.set('flag', false);
  if (rec.get('is_private') === undefined || rec.get('is_private') === null) rec.set('is_private', false);
  if (rec.get('focus') === undefined || rec.get('focus') === null) rec.set('focus', false);
  if (rec.get('all_day') === undefined || rec.get('all_day') === null) rec.set('all_day', false);
  if (!rec.get('start_time') && rec.get('due_date')) { rec.set('start_time', rec.get('due_date')); }

  // Request info - call ONCE, store reference
  var info = null;
  try { info = e.requestInfo(); } catch(ex) { /* no request context */ }

  // Auto-set user from auth context if not provided
  if (!rec.get('user')) {
    var auth = info && info.auth ? info.auth : null;
    if (auth) rec.set('user', auth.id);
  }
  // Auto-set family_id from user
  if (!rec.get('family_id') || rec.get('family_id') === '') {
    var uid = rec.get('user');
    if (uid) {
      try {
        var u = $app.findRecordById('users', uid);
        var fid = u.get('family_id');
        if (fid) rec.set('family_id', fid);
      } catch(ex) { /* user may not exist yet */ }
    }
  }
  // Subtask_ids from request data
  if (info) {
    try {
      var data = info.data || {};
      if (data && data.subtask_ids !== undefined) {
        rec.set('subtask_ids', data.subtask_ids);
      }
    } catch(ex) { /* no data */ }
  }
});

onRecordCreate('items', (e) => {
  var rec = e.record;
  // Canonical defaults - ALWAYS set, no outer try/catch
  if (rec.get('completed') === undefined || rec.get('completed') === null) rec.set('completed', false);
  if (!rec.get('quantity')) rec.set('quantity', 1);
  if (rec.get('is_private') === undefined || rec.get('is_private') === null) rec.set('is_private', false);

  // Request info - call ONCE, store reference
  var info = null;
  try { info = e.requestInfo(); } catch(ex) { /* no request context */ }

  // Auto-set user from auth context if not provided
  if (!rec.get('user')) {
    var auth = info && info.auth ? info.auth : null;
    if (auth) rec.set('user', auth.id);
  }
  // Auto-set family_id from user
  if (!rec.get('family_id') || rec.get('family_id') === '') {
    var uid = rec.get('user');
    if (uid) {
      try {
        var u = $app.findRecordById('users', uid);
        var fid = u.get('family_id');
        if (fid) rec.set('family_id', fid);
      } catch(ex) { /* ignore */ }
    }
  }
});

onRecordUpdate('tasks', (e) => {
  var info = null;
  try { info = e.requestInfo(); } catch(ex) {}
  if (info) {
    try {
      var data = info.data || {};
      if (data && data.subtask_ids !== undefined) {
        e.record.set('subtask_ids', data.subtask_ids);
      }
    } catch(err) { /* ignore */ }
  }
});

// ─── Public API endpoints ────────────────────────────────────────────────

routerAdd('GET', '/api/hook-health', (c) => c.json(200, { ok: true }));

// ── Version endpoint — returns deployment info for environment comparison ──
routerAdd('GET', '/api/version', (c) => {
  var env = 'unknown';
  var commit = 'unknown';
  try {
    var os = $os;
    env = String(os.getenv('DEPLOY_ENV') || 'unknown');
    commit = String(os.getenv('COMMIT_SHA') || 'unknown');
  } catch(e) { /* os not available */ }
  return c.json(200, {
    branch: 'main',
    commit: commit,
    env: env,
    pb: '0.35.1',
    note: 'See GitHub releases for full changelog'
  });
});

// ── Validation: create + immediate re-query (canonical path verification) ──
routerAdd('POST', '/api/validate-create', function(c) {
  try {
    var info = c.requestInfo();
    var body = info.body || {};
    var type = String(body.type || 'task').trim();
    var title = String(body.title || '').trim();
    if (!title) return c.json(400, { error: 'title required' });

    var auth = info.auth || c.get('authRecord');
    if (!auth) return c.json(401, { error: 'Unauthorized' });

    var collName = type === 'grocery' ? 'items' : 'tasks';
    var coll = $app.findCollectionByNameOrId(collName);
    var rec = new Record(coll);

    rec.set('title', title);
    rec.set('user', auth.id);

    if (type === 'grocery') {
      rec.set('completed', false);
      rec.set('quantity', Number(body.quantity) || 1);
      if (body.shop_id) rec.set('shop_id', body.shop_id);
    } else {
      rec.set('status', String(body.status || 'todo'));
      rec.set('flag', false);
      rec.set('is_private', false);
    }

    if (body.labels && Array.isArray(body.labels)) rec.set('labels', body.labels);
    if (body.assigned_to) rec.set('assigned_to', body.assigned_to);
    if (body.due_date) rec.set('due_date', body.due_date);
    if (body.priority) rec.set('priority', body.priority);

    $app.save(rec);

    // ── Validation: immediately re-query as the same user ──
    var verify = $app.findRecordById(collName, rec.id);
    if (!verify) return c.json(500, { error: 'VALIDATION FAILED: record not found after save' });

    var fid = String(auth.get('family_id') || '');
    if (fid) {
      var familyFilter = 'user.family_id = "' + fid + '"';
      var familyResults = $app.findRecordsByFilter(collName, familyFilter + ' && id = "' + rec.id + '"', '', 1, 0);
      if (familyResults.length === 0) {
        return c.json(500, { error: 'VALIDATION FAILED: record not queryable by family ' + fid });
      }
    }

    return c.json(201, {
      ok: true,
      id: rec.id,
      type: type,
      title: String(verify.get('title') || ''),
      created: String(verify.get('created') || ''),
      validated: true,
      queriable_by_family: true
    });
  } catch(e) {
    return c.json(500, { error: String(e) });
  }
});

// ─── Routes loaded from pb_hooks/routes/ ──
// Note: routes/openapi.js registers GET /api/openapi.json (inline spec)
// Note: routes/docs.js registers GET /api/docs + /api/swagger (Swagger UI HTML)
// Note: routes/api-tokens.js registers CRUD for API tokens

// ── Create invite code (server-side, bypasses PB API rules) ──
routerAdd('POST', '/api/invites/create', (c) => {
  try {
    var info = c.requestInfo();
    var auth = info && info.auth ? info.auth : null;
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    var role = String(auth.get('role') || '');
    if (role !== 'admin' && role !== 'owner') return c.json(403, { error: 'Admin only' });
    var inviterFamilyId = String(auth.get('family_id') || '').trim();
    if (!inviterFamilyId) return c.json(400, { error: 'Current admin has no family assigned' });

    var body = info.body || {};
    var type = String(body.type || 'human').trim();
    if (type !== 'human') {
      return c.json(400, { error: 'type must be \"human\"' });
    }

    // Generate invite code with CSPRNG
    var code = $security.randomString(12);

    var now = new Date();
    var expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    var coll = $app.findCollectionByNameOrId('invite_codes');
    var rec = new Record(coll);
    rec.set('code', code);
    rec.set('expires_at', expiresAt.toISOString());
    rec.set('used', false);
    rec.set('user', auth.id);
    rec.set('type', type);

    $app.save(rec);

    return c.json(201, {
      id: rec.id,
      code: code,
      created_by: auth.id,
      expires_at: expiresAt.toISOString(),
      used: false,
      type: type,
    });
  } catch (e) {
    return c.json(500, { error: String(e) });
  }
});

routerAdd('GET', '/api/setup-status', (c) => {
  try {
    var u = $app.findRecordsByFilter('users', '', '-created', 1, 0);
    var s = $app.findRecordsByFilter('app_settings', 'setup_complete = true', '-created', 1, 0);
    var hasUsers = u.length > 0;
    return c.json(200, { has_users: hasUsers, setup_complete: hasUsers || s.length > 0 });
  } catch(e) { return c.json(200, { has_users: false, setup_complete: false }); }
});

// ── Validate invite code (no auth required, public) ──
routerAdd('GET', '/api/validate-invite', (c) => {
  try {
    var q = c.requestInfo().query || {};
    var code = String(q.code || '').trim().toUpperCase();
    if (!code) return c.json(400, { status: 'error', message: 'code required' });

    var now = new Date().toISOString();
    var invites = $app.findRecordsByFilter('invite_codes', 'code = {:code} && used = false && expires_at > {:now}', '-created', 1, 0, { code: code, now: now });

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
    rec.set('verified', false);
    rec.set('email', data.email);
    rec.set('password', data.password);
    rec.set('passwordConfirm', data.passwordConfirm || data.password);
    rec.set('name', data.name || '');
    rec.set('emailVisibility', false);
    rec.set('role', data.role || 'user');
    rec.set('family_id', data.family_id || '');
    rec.set('member_status', data.member_status || 'active');
    rec.set('member_type', data.member_type || 'family_member');
    rec.set('language', ['nl', 'fr', 'en'].indexOf(String(data.language || '')) !== -1 ? data.language : 'en');
    u.save(rec);
    return rec;
  };

  var createFamily = function(name, createdBy) {
    var fc = $app.findCollectionByNameOrId('families');
    var fam = new Record(fc);
    fam.set('id', $security.randomString(15));
    fam.set('name', name || 'My Family');
    fam.set('created_by', createdBy);
    var u = $app.unsafeWithoutHooks();
    u.save(fam);
    return fam;
  };

  try {
    var info = c.requestInfo();
    var d = info.body || {};
    var userTypeRaw = String(d.user_type || 'family_member').trim();
    if (['family_member', 'family_assistant', 'human', 'agent'].indexOf(userTypeRaw) === -1) {
      return c.json(400, { error: 'Invalid user_type.' });
    }
    // Map legacy types to new identity model
    var memberType = userTypeRaw;
    if (userTypeRaw === 'family_member') memberType = 'human';
    if (userTypeRaw === 'family_assistant') memberType = 'agent';

    var existing = $app.findRecordsByFilter('users', '', '-created', 1, 0);
    var setupDone = $app.findRecordsByFilter('app_settings', 'setup_complete = true', '-created', 1, 0).length > 0;
    var shouldBootstrap = existing.length === 0;
    if (!shouldBootstrap && !setupDone && !String(d.invite_code || '').trim()) {
      throw new BadRequestError('Registration requires a valid invite code once the first account exists.', {});
    }
    if (shouldBootstrap) {
      // ── First user / setup flow ──
      if (!d.email || !d.password || d.password.length < 8) return c.json(400, { error: 'Email and password (min 8) required' });
      if (d.password !== d.passwordConfirm) return c.json(400, { error: 'Passwords do not match' });

      var uc = $app.findCollectionByNameOrId('users');
      var rec = createUser(uc, {
        email: d.email,
        password: d.password,
        passwordConfirm: d.passwordConfirm,
        name: d.name || d.email.split('@')[0],
        role: (memberType === 'agent') ? 'member' : 'admin',
        family_id: '',
        member_status: 'active',
        member_type: memberType
      });

      var fam = createFamily(d.family_name || 'My Family', rec.id);

      // Update user with family_id
      rec.set('family_id', fam.id);
      var u = $app.unsafeWithoutHooks();
      u.save(rec);

      return c.json(201, {
        user: { id: rec.id, email: String(rec.get('email')||''), name: String(rec.get('name')||''), role: String(rec.get('role')||'member'), family_id: fam.id }
      });
    }

    // ── Invite-based registration ──
    var ic = String(d.invite_code || '').trim().toUpperCase();
    if (!ic) throw new BadRequestError('Invite code required for registration.', {});
    var now = new Date().toISOString();
    var invites = $app.findRecordsByFilter('invite_codes', 'code = {:code} && used = false && expires_at > {:now}', '-created', 1, 0, { code: ic, now: now });
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
      family_id: fid,
      member_status: 'active',
      member_type: memberType
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
  } catch(e) { try { $app.logger().error('invite registration error: ' + String(e)); } catch(_e) {} return c.json(400, { error: 'Unable to register with invite code' }); }
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
      if (rawExp) { var expMs=0;if(typeof rawExp==='string')expMs=new Date(String(rawExp).replace(' ', 'T')).getTime();else if(rawExp&&typeof rawExp.getTime==='function')expMs=rawExp.getTime();else if(rawExp)expMs=new Date(String(rawExp).replace(' ', 'T')).getTime();var nowMs=new Date().getTime();if(expMs>0&&expMs<nowMs)return c.json(401,{'error':'API token has expired'}); }
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
    var auth = (info && info.auth) || c.get('authRecord');
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    var tokInfo = c.get('apiTokenInfo');
    function _hasPerm(req){ if(!tokInfo)return true; var ps=tokInfo.permissions||[]; for(var pi=0;pi<ps.length;pi++){var p=String(ps[pi]||''); if(p===req||p==='*')return true; var a=p.split(':'), b=req.split(':'); if(a.length===2&&b.length===2&&a[0]===b[0]&&a[1]==='*')return true;} return false; }
    if (!_hasPerm('tasks:read') && !_hasPerm('groceries:read')) return c.json(403, { error: 'Missing read permission' });
    function _canRead(r){ var uid=String(r.get('user')||''); if(uid===auth.id)return true; var af=String(auth.get('family_id')||''); if(!af||!uid)return false; try{var u=$app.findRecordById('users',uid); return String(u.get('family_id')||'')===af;}catch(e){return false;} }
    var q = info.query || {};
    var tasks = $app.findRecordsByFilter('tasks', '', '-created', 10000, 0).filter(_canRead).map(function(r) {
      return { id:r.id, type:'task', title: (r.get('title')||''), description: (r.get('blocked_comment')||''), status: (r.get('status')||'todo'), priority: (r.get('priority')||'medium'), assignee_id: (r.get('assigned_to')||''), labels: (r.get('labels')||[]), shop_id:'', quantity:null, created_by: (r.get('user')||''), completed_by:'', created_at: r.get("created"), updated_at: r.get("updated") };
    });
    var items = $app.findRecordsByFilter('items', '', '-created', 10000, 0).filter(_canRead).map(function(r) {
      return { id:r.id, type:'grocery', title: (r.get('title')||''), description:'', status: r.get('completed')?'done':'todo', priority: (r.get('priority')||'medium'), assignee_id: (r.get('assigned_to')||''), labels: (r.get('labels')||[]), shop_id: (r.get('shop_id')||''), quantity: (r.get('quantity')||1), created_by: (r.get('user')||''), completed_by:'', created_at: r.get("created"), updated_at: r.get("updated") };
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
      if (rawExp) { var expMs=0;if(typeof rawExp==='string')expMs=new Date(String(rawExp).replace(' ', 'T')).getTime();else if(rawExp&&typeof rawExp.getTime==='function')expMs=rawExp.getTime();else if(rawExp)expMs=new Date(String(rawExp).replace(' ', 'T')).getTime();var nowMs=new Date().getTime();if(expMs>0&&expMs<nowMs)return c.json(401,{'error':'API token has expired'}); }
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

    var needsAuth = ['create','update','complete','assign','delete','list','filters','add_subtask','set_role','set_user_block','delete_user'];
    if (needsAuth.indexOf(action) >= 0) {
      auth = info.auth || c.get('authRecord');
      if (!auth) return c.json(401, { error: 'Unauthorized' });
    }

    var gv = function(o,k,f) { if(f===undefined)f='';if(!o)return f;if(Object.prototype.hasOwnProperty.call(o,k)){var v=o[k];return(v===undefined||v===null)?f:v;}return f; };
    var tokInfo = c.get('apiTokenInfo');
    function _hasPerm(req){ if(!tokInfo)return true; var ps=tokInfo.permissions||[]; for(var pi=0;pi<ps.length;pi++){var p=String(ps[pi]||''); if(p===req||p==='*')return true; var a=p.split(':'), b=req.split(':'); if(a.length===2&&b.length===2&&a[0]===b[0]&&a[1]==='*')return true;} return false; }
    var reqPerm = '';
    var reqType = String(gv(d,'type','task')).trim();
    if(action==='list'||action==='filters') reqPerm='tasks:read';
    if(action==='create'||action==='update'||action==='complete'||action==='assign') reqPerm=(reqType==='grocery'?'groceries:write':'tasks:write');
    if(action==='delete') reqPerm=(reqType==='grocery'?'groceries:delete':'tasks:delete');
    if(action==='add_subtask') reqPerm='tasks:write';
    if(tokInfo && (action==='set_role'||action==='set_user_block'||action==='delete_user')) return c.json(403,{error:'API tokens cannot manage members'});
    if(reqPerm && !_hasPerm(reqPerm)) return c.json(403,{error:'Missing permission: '+reqPerm});
    function _canAccess(r){ if(!auth||!r)return false; var uid=String(r.get('user')||r.get('created_by')||''); if(uid&&uid===auth.id)return true; var af=String(auth.get('family_id')||''); if(!af||!uid)return false; try{var u=$app.findRecordById('users',uid); return String(u.get('family_id')||'')===af;}catch(e){return false;} }
    function _freshAuth(){ if(!auth||!auth.id)return null; try { return $app.findRecordById('users', auth.id); } catch(e) { return null; } }
    function _isFamilyAdmin(user){ var r=String(user&&user.get('role')||''); return r==='admin'||r==='owner'; }

    if (action === 'list') {
    var q = info.query || {};
      var tasks = $app.findRecordsByFilter('tasks', '', '-created', 10000, 0).filter(_canAccess).map(function(r) {
        return { id:r.id, type:'task', title:(r.get('title')||''), description:(r.get('blocked_comment')||''), status:(r.get('status')||'todo'), assignee_id:(r.get('assigned_to')||''), labels:(r.get('labels')||[]), shop_id:'', quantity:null, created_by:(r.get('user')||''), completed_by:'', created_at:r.get("created"), updated_at:r.get("updated") };
      });
      var items = $app.findRecordsByFilter('items', '', '-created', 10000, 0).filter(_canAccess).map(function(r) {
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
      if(!_canAccess(rec)) return c.json(404,{error:'Entry not found'});
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
      if(!_canAccess(rec)) return c.json(404,{error:'Entry not found'});
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
      if(!_canAccess(rec)) return c.json(404,{error:'Entry not found'});
      $app.delete(rec);return c.json(200,{deleted:true});
    }

    if (action === 'add_subtask') {
      if (!auth) return c.json(401, { error: 'Unauthorized' });
      var taskId = String(gv(d, 'task_id', '')).trim();
      var subtaskId = String(gv(d, 'subtask_id', '')).trim();
      if (!taskId || !subtaskId) return c.json(400, { error: 'task_id and subtask_id required' });
      var parent = $app.findRecordById('tasks', taskId);
      if (!parent) return c.json(404, { error: 'Parent task not found' });
      if (!_canAccess(parent)) return c.json(404, { error: 'Parent task not found' });
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
      var labels = $app.findRecordsByFilter('labels','', 'name',10000,0).filter(_canAccess).map(function(r){return{id:r.id,name:r.get('name'),color:r.get('color')};});
      var shops = $app.findRecordsByFilter('shops','', 'name',10000,0).filter(_canAccess).map(function(r){return{id:r.id,name:r.get('name'),color:r.get('color')};});
      var af=String(auth.get('family_id')||''); var uf=af?'family_id = {:f}':'id = {:u}'; var up=af?{f:af}:{u:auth.id};
      var users = $app.findRecordsByFilter('users',uf,'name',10000,0,up).map(function(r){return{id:r.id,name:r.get('name')||r.get('email')||r.id};});
      return c.json(200,{labels:labels,shops:shops,users:users});
    }

    // ── Admin: set_role (family scoped, single admin per family) ──
    if (action === 'set_role') {
      if (!auth) return c.json(401, { error: 'Unauthorized' });
      var actorRoleRecord = _freshAuth();
      if (!actorRoleRecord || !_isFamilyAdmin(actorRoleRecord)) return c.json(403, { error: 'Admin only' });
      var targetId = String(gv(d, 'user_id', '')).trim();
      var newRole = String(gv(d, 'role', '')).trim();
      if (!targetId || !newRole) return c.json(400, { error: 'user_id and role required' });
      if (['owner','admin','member','agent'].indexOf(newRole) === -1) return c.json(400, { error: 'Invalid role' });

      var actorFamilyId = String(actorRoleRecord.get('family_id') || '').trim();
      if (!actorFamilyId) return c.json(400, { error: 'Current admin has no family assigned' });

      var target = $app.findRecordById('users', targetId);
      if (!target) return c.json(404, { error: 'User not found' });

      var targetFamilyId = String(target.get('family_id') || '').trim();
      if (targetFamilyId !== actorFamilyId) {
        return c.json(403, { error: 'You can only manage members in your own family.' });
      }

      if (String(target.get('role') || '') === 'owner' && newRole !== 'owner') {
        return c.json(403, { error: 'Cannot demote the owner' });
      }

      // Agents cannot be admin or owner
      var targetMemberType = String(target.get('member_type') || '');
      if (targetMemberType === 'agent' && (newRole === 'admin' || newRole === 'owner')) {
        return c.json(400, { error: 'Agents cannot be assigned admin or owner roles.' });
      }

      var familyAdmins = $app.findRecordsByFilter('users', 'family_id = "' + actorFamilyId + '" && (role = "admin" || role = "owner")', '', 10000, 0);

      // Keep a single admin/owner per family: promoting a new admin demotes the others in that family only.
      if (newRole === 'admin' || newRole === 'owner') {
        var u2 = $app.unsafeWithoutHooks();
        for (var i = 0; i < familyAdmins.length; i++) {
          if (familyAdmins[i].id !== targetId) {
            familyAdmins[i].set('role', 'member');
            u2.save(familyAdmins[i]);
          }
        }
      }

      // Prevent the only family admin from demoting themselves without promoting someone else first.
      if (newRole !== 'admin' && newRole !== 'owner' && actorRoleRecord.id === targetId) {
        var otherAdmins = [];
        for (var i = 0; i < familyAdmins.length; i++) {
          if (familyAdmins[i].id !== targetId) otherAdmins.push(familyAdmins[i]);
        }
        if (otherAdmins.length === 0) return c.json(400, { error: 'You are the only admin. Promote someone else first.' });
      }

      var u = $app.unsafeWithoutHooks();
      target.set('role', newRole);
      u.save(target);
      return c.json(200, { success: true, user_id: targetId, role: newRole });
    }

    // ── Admin: block/unblock member (family scoped, owner protected) ──
    if (action === 'set_user_block') {
      if (!auth) return c.json(401, { error: 'Unauthorized' });
      var actorBlockRecord = _freshAuth();
      if (!actorBlockRecord || !_isFamilyAdmin(actorBlockRecord)) return c.json(403, { error: 'Admin only' });
      var targetIdBlock = String(gv(d, 'user_id', '')).trim();
      var blocked = gv(d, 'blocked', false);
      if (!targetIdBlock) return c.json(400, { error: 'user_id required' });
      if (actorBlockRecord.id === targetIdBlock) return c.json(400, { error: 'Cannot block yourself' });
      var targetBlock = $app.findRecordById('users', targetIdBlock);
      if (!targetBlock) return c.json(404, { error: 'User not found' });
      var actorFamilyBlock = String(actorBlockRecord.get('family_id') || '').trim();
      if (!actorFamilyBlock || String(targetBlock.get('family_id') || '').trim() !== actorFamilyBlock) return c.json(403, { error: 'You can only manage members in your own family.' });
      if (String(targetBlock.get('role') || '') === 'owner') return c.json(403, { error: 'Cannot block the owner' });
      var ub = $app.unsafeWithoutHooks();
      targetBlock.set('member_status', blocked ? 'blocked' : 'active');
      ub.save(targetBlock);
      return c.json(200, { success: true, user_id: targetIdBlock, blocked: !!blocked });
    }

    // ── Admin: delete member (family scoped, owner/self protected) ──
    if (action === 'delete_user') {
      if (!auth) return c.json(401, { error: 'Unauthorized' });
      var actorDeleteRecord = _freshAuth();
      if (!actorDeleteRecord || !_isFamilyAdmin(actorDeleteRecord)) return c.json(403, { error: 'Admin only' });
      var targetIdDel = String(gv(d, 'user_id', '')).trim();
      if (!targetIdDel) return c.json(400, { error: 'user_id required' });
      if (actorDeleteRecord.id === targetIdDel) return c.json(400, { error: 'Cannot delete yourself' });
      var targetDel = $app.findRecordById('users', targetIdDel);
      if (!targetDel) return c.json(404, { error: 'User not found' });
      var actorFamilyDel = String(actorDeleteRecord.get('family_id') || '').trim();
      if (!actorFamilyDel || String(targetDel.get('family_id') || '').trim() !== actorFamilyDel) return c.json(403, { error: 'You can only manage members in your own family.' });
      if (String(targetDel.get('role') || '') === 'owner') return c.json(403, { error: 'Cannot delete the owner' });
      $app.delete(targetDel);
      return c.json(200, { success: true, user_id: targetIdDel, deleted: true });
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
      var members = $app.findRecordsByFilter('users', 'family_id = "' + fid + '"', '', 10000, 0);
      for (var mi = 0; mi < members.length; mi++) { userIds.push('"' + members[mi].id + '"'); }
    } else {
      userIds.push('"' + auth.id + '"');
    }
    var userFilter = 'user.id = ' + userIds.join(' || user.id = ');
    var allTokens = $app.findRecordsByFilter('api_tokens', userFilter, '', 10000, 0);
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
      var members = $app.findRecordsByFilter('users', 'family_id = "' + fid + '"', '', 10000, 0);
      for (var mi = 0; mi < members.length; mi++) { userIds.push('"' + members[mi].id + '"'); }
    } else {
      userIds.push('"' + auth.id + '"');
    }
    var userFilter = 'user.id = ' + userIds.join(' || user.id = ');
    var tokens = $app.findRecordsByFilter('api_tokens', userFilter + ' && enabled=false', '', 10000, 0);
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
    var tokenUser = null; try { tokenUser = $app.findRecordById('users', String(token.get('user') || '')); } catch(e) {}
    if (!tokenUser || String(tokenUser.get('family_id') || '') !== String(auth.get('family_id') || '')) return c.json(403, { error: 'Token is outside your family.' });
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
    var tokenUser = null; try { tokenUser = $app.findRecordById('users', String(token.get('user') || '')); } catch(e) {}
    if (!tokenUser || String(tokenUser.get('family_id') || '') !== String(auth.get('family_id') || '')) return c.json(403, { error: 'Token is outside your family.' });

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
      var members = $app.findRecordsByFilter('users', 'family_id = "' + fid + '"', '', 10000, 0);
      for (var mi = 0; mi < members.length; mi++) { userIds.push('"' + members[mi].id + '"'); }
    } else {
      userIds.push('"' + auth.id + '"');
    }
    var userFilter = 'user.id = ' + userIds.join(' || user.id = ');
    var tokens = $app.findRecordsByFilter('api_tokens', userFilter, '', 10000, 0);
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
    var tokenUser = null; try { tokenUser = $app.findRecordById('users', String(token.get('user') || '')); } catch(e) {}
    if (!tokenUser || String(tokenUser.get('family_id') || '') !== String(auth.get('family_id') || '')) return c.json(403, { error: 'Token is outside your family.' });
    $app.delete(token);
    return c.json(200, { deleted: true });
  } catch(e) { return c.json(500, { error: String(e) }); }
});
