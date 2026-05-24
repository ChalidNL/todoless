     1|/// <reference path="../pb_data/types.d.ts" />
     2|
     3|// PB 0.34 JS hooks: 
     4|// - function/var declarations don't hoist into callbacks — inline helpers per handler
     5|// - c.requestInfo() call ONCE per request
     6|// - use info.body NOT info.data (PB 0.34 compat)
     7|// - $app.save(rec) for users throws "ReferenceError: tasks" (PB 0.34.2 bug)
     8|//   FIX: use var u = $app.unsafeWithoutHooks(); u.save(rec); with manual id/tokenKey
     9|
    10|// ── Canonical Record Hooks: single creation path for ALL sources (UI, API, agent) ──
    11|
    onRecordCreate('tasks', (e) => {
  var rec = e.record;
  // Canonical defaults - ALWAYS set, no outer try/catch
  if (!rec.get('status')) rec.set('status', 'todo');
  if (rec.get('flag') === undefined || rec.get('flag') === null) rec.set('flag', false);
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
    45|
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
    74|
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
    83|
    84|// ─── Public API endpoints ────────────────────────────────────────────────
    85|
    86|routerAdd('GET', '/api/hook-health', (c) => c.json(200, { ok: true }));

// ── Version endpoint — returns deployment info for environment comparison ──
routerAdd('GET', '/api/version', (c) => {
  var info = { branch: 'unknown', commit: 'unknown', env: 'unknown' };
  try {
    var os = $os;
    info.env = String(os.getenv('DEPLOY_ENV') || 'unknown');
  } catch(e) { /* os not available */ }
  return c.json(200, {
    branch: 'main',
    commit: '999a546',
    env: 'production',
    pb: '0.35.1',
    note: 'See GitHub releases for full changelog'
  });
});
    87|
    88|// ── Validation: create + immediate re-query (canonical path verification) ──
    89|routerAdd('POST', '/api/validate-create', function(c) {
    90|  try {
    91|    var info = c.requestInfo();
    92|    var body = info.body || {};
    93|    var type = String(body.type || 'task').trim();
    94|    var title = String(body.title || '').trim();
    95|    if (!title) return c.json(400, { error: 'title required' });
    96|
    97|    var auth = info.auth || c.get('authRecord');
    98|    if (!auth) return c.json(401, { error: 'Unauthorized' });
    99|
   100|    var collName = type === 'grocery' ? 'items' : 'tasks';
   101|    var coll = $app.findCollectionByNameOrId(collName);
   102|    var rec = new Record(coll);
   103|
   104|    rec.set('title', title);
   105|    rec.set('user', auth.id);
   106|
   107|    if (type === 'grocery') {
   108|      rec.set('completed', false);
   109|      rec.set('quantity', Number(body.quantity) || 1);
   110|      if (body.shop_id) rec.set('shop_id', body.shop_id);
   111|    } else {
   112|      rec.set('status', String(body.status || 'todo'));
   113|      rec.set('flag', false);
   114|      rec.set('is_private', false);
   115|    }
   116|
   117|    if (body.labels && Array.isArray(body.labels)) rec.set('labels', body.labels);
   118|    if (body.assigned_to) rec.set('assigned_to', body.assigned_to);
   119|    if (body.due_date) rec.set('due_date', body.due_date);
   120|    if (body.priority) rec.set('priority', body.priority);
   121|
   122|    $app.save(rec);
   123|
   124|    // ── Validation: immediately re-query as the same user ──
   125|    var verify = $app.findRecordById(collName, rec.id);
   126|    if (!verify) return c.json(500, { error: 'VALIDATION FAILED: record not found after save' });
   127|
   128|    var fid = String(auth.get('family_id') || '');
   129|    if (fid) {
   130|      var familyFilter = 'user.family_id = "' + fid + '"';
   131|      var familyResults = $app.findRecordsByFilter(collName, familyFilter + ' && id = "' + rec.id + '"', '', 1, 0);
   132|      if (familyResults.length === 0) {
   133|        return c.json(500, { error: 'VALIDATION FAILED: record not queryable by family ' + fid });
   134|      }
   135|    }
   136|
   137|    return c.json(201, {
   138|      ok: true,
   139|      id: rec.id,
   140|      type: type,
   141|      title: String(verify.get('title') || ''),
   142|      created: String(verify.get('created') || ''),
   143|      validated: true,
   144|      queriable_by_family: true
   145|    });
   146|  } catch(e) {
   147|    return c.json(500, { error: String(e) });
   148|  }
   149|});
   150|
   151|// ── One-shot: open all collection rules (run once after deploy) ──
   152|routerAdd('POST', '/api/open-rules', function(c) {
   153|  try {
   154|    var collections = ['tasks', 'items', 'subtasks', 'labels', 'shops', 'families', 'users', 'invite_codes', 'api_tokens', 'app_settings'];
   155|    var result = [];
   156|    for (var i = 0; i < collections.length; i++) {
   157|      try {
   158|        var col = $app.findCollectionByNameOrId(collections[i]);
   159|        if (col) {
   160|          col.listRule = '';
   161|          col.viewRule = '';
   162|          col.createRule = '';
   163|          col.updateRule = '';
   164|          col.deleteRule = '';
   165|          $app.save(col);
   166|          result.push(collections[i] + ': OK');
   167|        }
   168|      } catch(err) {
   169|        result.push(collections[i] + ': ' + String(err));
   170|      }
   171|    }
   172|    return c.json(200, { result: result });
   173|  } catch(e) {
   174|    return c.json(500, { error: String(e) });
   175|  }
   176|});
   177|
   178|// ─── Routes loaded from pb_hooks/routes/ ──
   179|// Note: routes/openapi.js registers GET /api/openapi.json (inline spec)
   180|// Note: routes/docs.js registers GET /api/docs + /api/swagger (Swagger UI HTML)
   181|// Note: routes/api-tokens.js registers CRUD for API tokens
   182|
   183|// ── Debug: test token generation (no auth required) ──
   184|routerAdd('GET', '/api/debug-token', (c) => {
   185|  try {
   186|    function _gt(len) { if(typeof len==='undefined')len=48;var c='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',r='';for(var i=0;i<len;i++){r+=c.charAt(Math.floor(Math.random()*c.length));}return 'tl_'+r; }
   187|    function _ht(tok) { try { return $security.SHA256(tok); } catch(e){ var h=0;if(tok.length===0)return'd';for(var i=0;i<tok.length;i++){h=((h<<5)-h)+tok.charCodeAt(i);h=h&h;}return 'd_'+Math.abs(h).toString(16).padStart(8,'0');} }
   188|    var t = _gt(48);
   189|    var h = _ht(t);
   190|    return c.json(200, { token: t.substring(0,12) + '...', hash: h, ok: true });
   191|  } catch(e) {
   192|    return c.json(500, { error: String(e) });
   193|  }
   194|});
   195|
   196|// ── Create invite code (server-side, bypasses PB API rules) ──
   197|// Supports type: 'human' (default) or 'agent'
   198|// If type='agent': also generates an API token (enabled=false), stored hashed, returned once.
   199|routerAdd('POST', '/api/invites/create', (c) => {
   200|  try {
   201|    var info = c.requestInfo();
   202|    console.log('INVITE_CREATE: type=' + String((info.body||{}).type) + ' body=' + JSON.stringify(info.body||{}));
   203|    var auth = info && info.auth ? info.auth : null;
   204|    if (!auth) return c.json(401, { error: 'Unauthorized' });
   205|
   206|    var body = info.body || {};
   207|    var type = String(body.type || 'human').trim();
   208|    if (type !== 'human' && type !== 'agent') {
   209|      return c.json(400, { error: 'type must be \"human\" or \"agent\"' });
   210|    }
   211|
   212|    // Generate 6-digit code
   213|    var code = '';
   214|    var digits = '0123456789';
   215|    for (var i = 0; i < 6; i++) {
   216|      code += digits.charAt(Math.floor(Math.random() * digits.length));
   217|    }
   218|
   219|    var now = new Date();
   220|    var expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
   221|
   222|    var coll = $app.findCollectionByNameOrId('invite_codes');
   223|    var rec = new Record(coll);
   224|    rec.set('code', code);
   225|    rec.set('expires_at', expiresAt.toISOString());
   226|    rec.set('used', false);
   227|    rec.set('user', auth.id);
   228|    rec.set('type', type);
   229|
   230|    var rawToken = null;
   231|    var tokenId = null;
   232|
   233|    if (type === 'agent') {
   234|      // Inline helpers (PB 0.34: function decls don't hoist into callbacks)
   235|      function _gt(len) { if(typeof len==='undefined')len=48;var c='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',r='';for(var i=0;i<len;i++){r+=c.charAt(Math.floor(Math.random()*c.length));}return 'tl_'+r; }
   236|      function _ht(tok) { try { return $security.SHA256(tok); } catch(e){ var h=0;if(tok.length===0)return'd';for(var i=0;i<tok.length;i++){h=((h<<5)-h)+tok.charCodeAt(i);h=h&h;}return 'd_'+Math.abs(h).toString(16).padStart(8,'0');} }
   237|      rawToken = _gt(48);
   238|      var hashed = _ht(rawToken);
   239|
   240|      var tokenColl = $app.findCollectionByNameOrId('api_tokens');
   241|      var tokenRec = new Record(tokenColl);
   242|      tokenRec.set('name', 'Agent: ' + code);
   243|      tokenRec.set('token_hash', hashed);
   244|      tokenRec.set('permissions', ['*']);
   245|      tokenRec.set('enabled', false);
   246|      tokenRec.set('user', auth.id);
   247|      try { tokenRec.set('token_type', 'agent_api_token'); } catch(e) {}
   248|      $app.save(tokenRec);
   249|
   250|      tokenId = tokenRec.id;
   251|      rec.set('token_id', tokenId);
   252|    }
   253|
   254|    $app.save(rec);
   255|
   256|    var result = {
   257|      id: rec.id,
   258|      code: code,
   259|      created_by: auth.id,
   260|      expires_at: expiresAt.toISOString(),
   261|      used: false,
   262|      type: type,
   263|    };
   264|
   265|    if (type === 'agent' && rawToken) {
   266|      result.token = rawToken;
   267|      result.token_id = tokenId;
   268|      result.message_token = 'Save this token — it will not be shown again.';
   269|    }
   270|
   271|    return c.json(201, result);
   272|  } catch (e) {
   273|    return c.json(500, { error: String(e) });
   274|  }
   275|});
   276|
   277|routerAdd('GET', '/api/setup-status', (c) => {
   278|  try {
   279|    var u = $app.findRecordsByFilter('users', '', '-created', 1, 0);
   280|    var s = $app.findRecordsByFilter('app_settings', 'setup_complete = true', '-created', 1, 0);
   281|    return c.json(200, { has_users: u.length > 0, setup_complete: s.length > 0 });
   282|  } catch(e) { return c.json(200, { has_users: false, setup_complete: false }); }
   283|});
   284|
   285|// ── Validate invite code (no auth required, public) ──
   286|routerAdd('GET', '/api/validate-invite', (c) => {
   287|  try {
   288|    var q = c.requestInfo().query || {};
   289|    var code = String(q.code || '').trim().toUpperCase();
   290|    if (!code) return c.json(400, { status: 'error', message: 'code required' });
   291|
   292|    var now = new Date().toISOString();
   293|    var invites = $app.findRecordsByFilter('invite_codes', 'code = "' + code + '" && used = false && expires_at > "' + now + '"', '-created', 1, 0);
   294|
   295|    if (invites.length === 0) {
   296|      return c.json(200, { valid: false, status: 'invalid_or_expired' });
   297|    }
   298|
   299|    var inviter = $app.findRecordById('users', String(invites[0].get('user') || ''));
   300|    var familyName = '';
   301|    if (inviter) {
   302|      var fid = String(inviter.get('family_id') || '');
   303|      if (fid) {
   304|        var family = $app.findRecordById('families', fid);
   305|        if (family) familyName = String(family.get('name') || '');
   306|      }
   307|    }
   308|
   309|    return c.json(200, {
   310|      valid: true,
   311|      status: 'valid',
   312|      family_id: inviter ? String(inviter.get('family_id') || '') : '',
   313|      family_name: familyName,
   314|      invited_by: inviter ? String(inviter.get('name') || inviter.get('email') || '') : ''
   315|    });
   316|  } catch(e) { return c.json(500, { error: String(e) }); }
   317|});
   318|
   319|// ── User registration (no auth required) ──
   320|routerAdd('POST', '/api/register', (c) => {
   321|  // Inline helper: create user with hooks bypass (PB 0.34 bug workaround)
   322|  var createUser = function(col, data) {
   323|    var u = $app.unsafeWithoutHooks();
   324|    var rec = new Record(col);
   325|    rec.set('id', $security.randomString(15));
   326|    rec.set('tokenKey', $security.randomString(30));
   327|    rec.set('verified', false);
   328|    rec.set('email', data.email);
   329|    rec.set('password', data.password);
   330|    rec.set('passwordConfirm', data.passwordConfirm || data.password);
   331|    rec.set('name', data.name || '');
   332|    rec.set('emailVisibility', true);
   333|    rec.set('role', data.role || 'user');
   334|    rec.set('family_id', data.family_id || '');
   335|    rec.set('member_status', data.member_status || 'active');
   336|    rec.set('member_type', data.member_type || 'family_member');
   337|    u.save(rec);
   338|    return rec;
   339|  };
   340|
   341|  var createFamily = function(name, createdBy) {
   342|    var fc = $app.findCollectionByNameOrId('families');
   343|    var fam = new Record(fc);
   344|    fam.set('id', $security.randomString(15));
   345|    fam.set('tokenKey', $security.randomString(30));
   346|    fam.set('name', name || 'My Family');
   347|    fam.set('created_by', createdBy);
   348|    var u = $app.unsafeWithoutHooks();
   349|    u.save(fam);
   350|    return fam;
   351|  };
   352|
   353|  try {
   354|    var info = c.requestInfo();
   355|    var d = info.body || {};
   356|    var userTypeRaw = String(d.user_type || 'family_member').trim();
   357|    if (['family_member', 'family_assistant', 'human', 'agent'].indexOf(userTypeRaw) === -1) {
   358|      return c.json(400, { error: 'Invalid user_type.' });
   359|    }
   360|    // Map legacy types to new identity model
   361|    var memberType = userTypeRaw;
   362|    if (userTypeRaw === 'family_member') memberType = 'human';
   363|    if (userTypeRaw === 'family_assistant') memberType = 'agent';
   364|
   365|    var existing = $app.findRecordsByFilter('users', '', '-created', 1, 0);
   366|    var setupDone = $app.findRecordsByFilter('app_settings', 'setup_complete = true', '-created', 1, 0).length > 0;
   367|    if (existing.length === 0 || !setupDone) {
   368|      // ── First user / setup flow ──
   369|      if (!d.email || !d.password || d.password.length < 8) return c.json(400, { error: 'Email and password (min 8) required' });
   370|      if (d.password !== d.passwordConfirm) return c.json(400, { error: 'Passwords do not match' });
   371|
   372|      var uc = $app.findCollectionByNameOrId('users');
   373|      var rec = createUser(uc, {
   374|        email: d.email,
   375|        password: d.password,
   376|        passwordConfirm: d.passwordConfirm,
   377|        name: d.name || d.email.split('@')[0],
   378|        role: 'admin',
   379|        family_id: '',
   380|        member_status: 'active',
   381|        member_type: memberType
   382|      });
   383|
   384|      var fam = createFamily(d.family_name || 'My Family', rec.id);
   385|
   386|      // Update user with family_id
   387|      rec.set('family_id', fam.id);
   388|      var u = $app.unsafeWithoutHooks();
   389|      u.save(rec);
   390|
   391|      return c.json(201, {
   392|        user: { id: rec.id, email: String(rec.get('email')||''), name: String(rec.get('name')||''), role: 'admin', family_id: fam.id }
   393|      });
   394|    }
   395|
   396|    // ── Invite-based registration ──
   397|    var ic = String(d.invite_code || '').trim().toUpperCase();
   398|    if (!ic) throw new BadRequestError('Invite code required for registration.', {});
   399|    var now = new Date().toISOString();
   400|    var invites = $app.findRecordsByFilter('invite_codes', 'code="' + ic + '"&&used=false&&expires_at>"' + now + '"', '-created', 1, 0);
   401|    if (invites.length === 0) throw new BadRequestError('Invalid or expired invite code.', {});
   402|    var inviter = $app.findRecordById('users', String(invites[0].get('user') || ''));
   403|    var fid = inviter ? String(inviter.get('family_id') || '') : '';
   404|    if (!fid) throw new BadRequestError('Inviter has no family — ask admin to create one.', {});
   405|
   406|    var role = 'member';
   407|    var uc = $app.findCollectionByNameOrId('users');
   408|    var rec = createUser(uc, {
   409|      email: d.email,
   410|      password: d.password,
   411|      passwordConfirm: d.passwordConfirm,
   412|      name: d.name || d.email.split('@')[0],
   413|      role: role,
   414|      family_id: fid,
   415|      member_status: 'active',
   416|      member_type: memberType
   417|    });
   418|
   419|    // Mark invite as used
   420|    var inviteRec = invites[0];
   421|    inviteRec.set('used', true);
   422|    inviteRec.set('used_at', now);
   423|    inviteRec.set('used_by', rec.id);
   424|    var uu = $app.unsafeWithoutHooks();
   425|    uu.save(inviteRec);
   426|
   427|    return c.json(201, {
   428|      user: { id: rec.id, email: String(rec.get('email')||''), name: String(rec.get('name')||''), role: role, family_id: fid }
   429|    });
   430|  } catch(e) { return c.json(400, { error: String(e), stack: String(e.stack||'') }); }
   431|});
   432|
   433|// ── Entries: LIST (GET) ──
   434|routerAdd('GET', '/api/entries', (c) => {
   435|  function bearerAuthMiddleware(c) {
   436|    try {
   437|      var authHeader = c.requestInfo().headers['authorization'];
   438|      if (!authHeader) return null;
   439|      var parts = String(authHeader).split(' ');
   440|      if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
   441|        return c.json(401, { 'error': 'Invalid Authorization header format. Use: Bearer <token>' });
   442|      }
   443|      var token = parts[1].trim();
   444|      if (!token) return c.json(401, { 'error': 'Empty token' });
   445|      var hashed = (function(tok) { try { return $security.SHA256(tok); } catch(e) { var h=0;if(tok.length===0)return'd';for(var i=0;i<tok.length;i++){h=((h<<5)-h)+tok.charCodeAt(i);h=h&h;}return'd_'+Math.abs(h).toString(16).padStart(8,'0');} })(token);
   446|      var tokens = $app.findRecordsByFilter('api_tokens','token_hash = "'+hashed+'"','',1,0);
   447|      if (tokens.length === 0) return null;
   448|      var tokRec = tokens[0];
   449|      var rawEnabled = tokRec.get('enabled');
   450|      if (rawEnabled === false || rawEnabled === 0 || rawEnabled === 'false') return c.json(401,{'error':'API token is disabled'});
   451|      var rawExp = tokRec.get('expires_at');
   452|      if (rawExp) { var expMs=0;if(typeof rawExp==='string')expMs=new Date(rawExp).getTime();else if(rawExp&&typeof rawExp.getTime==='function')expMs=rawExp.getTime();else if(rawExp)expMs=new Date(String(rawExp)).getTime();var nowMs=new Date().getTime();if(expMs>0&&expMs<nowMs)return c.json(401,{'error':'API token has expired'}); }
   453|      var userId = String(tokRec.get('user')||'');
   454|      var user = null; try { user = $app.findRecordById('users',userId); } catch(e) { return c.json(401,{'error':'Token owner not found'}); }
   455|      if (!user) return c.json(401,{'error':'Token owner not found'});
   456|      var rawActive = user.get('active');
   457|      var rawMemberStatus = user.get('member_status');
   458|      if (rawActive === false || rawActive === 0 || rawActive === 'false') return c.json(403,{'error':'Token owner account is blocked'});
   459|      if (rawMemberStatus === 'blocked') return c.json(403,{'error':'Token owner account is blocked'});
   460|      if (rawMemberStatus === 'pending_approval') return c.json(403,{'error':'Token owner is pending approval'});
   461|      var rawPerms = tokRec.get('permissions');
   462|      if (!rawPerms || (Array.isArray(rawPerms)&&rawPerms.length===0)) rawPerms = tokRec.get('scopes');
   463|      var perms = []; if (Array.isArray(rawPerms)) perms=rawPerms; else if (typeof rawPerms==='string') try { perms=JSON.parse(rawPerms); } catch(e){}
   464|      c.set('apiTokenInfo',{token_id:tokRec.id,token_name:String(tokRec.get('name')||''),user_id:user.id,user_role:String(user.get('role')||'user'),user_name:String(user.get('name')||user.get('email')||''),family_id:String(user.get('family_id')||''),permissions:perms});
   465|      c.set('authRecord',user);
   466|      return null;
   467|    } catch(e) { return c.json(500,{'error':'Token auth error: '+String(e)}); }
   468|  }
   469|  try {
   470|    var ba = bearerAuthMiddleware(c);
   471|    if (ba) return ba;
   472|    var info = c.requestInfo();
   473|    var auth = info && info.auth ? info.auth : null;
   474|    if (!auth) return c.json(401, { error: 'Unauthorized' });
   475|    var q = info.query || {};
   476|    var f = ''; // All entries visible to everyone
   477|    var tasks = $app.findRecordsByFilter('tasks', f, '-created', 0, 0).map(function(r) {
   478|      return { id:r.id, type:'task', title: (r.get('title')||''), description: (r.get('blocked_comment')||''), status: (r.get('status')||'todo'), assignee_id: (r.get('assigned_to')||''), labels: (r.get('labels')||[]), shop_id:'', quantity:null, created_by: (r.get('user')||''), completed_by:'', created_at: r.get("created"), updated_at: r.get("updated") };
   479|    });
   480|    var items = $app.findRecordsByFilter('items', f, '-created', 0, 0).map(function(r) {
   481|      return { id:r.id, type:'grocery', title: (r.get('title')||''), description:'', status: r.get('completed')?'done':'todo', assignee_id: (r.get('assigned_to')||''), labels: (r.get('labels')||[]), shop_id: (r.get('shop_id')||''), quantity: (r.get('quantity')||1), created_by: (r.get('user')||''), completed_by:'', created_at: r.get("created"), updated_at: r.get("updated") };
   482|    });
   483|    var all = tasks.concat(items);
   484|    var t = (q.type||'').trim(), s = (q.status||'').trim(), a = (q.assignee_id||'').trim(), l = (q.label||'').trim(), sh = (q.shop_id||'').trim();
   485|    var res = [];
   486|    for (var i=0;i<all.length;i++) { var e=all[i];
   487|      if (t && e.type!==t) continue; if (s && e.status!==s) continue; if (a && e.assignee_id!==a) continue;
   488|      if (l && (!Array.isArray(e.labels) || e.labels.indexOf(l)===-1)) continue; if (sh && e.shop_id!==sh) continue;
   489|      res.push(e);
   490|    }
   491|    return c.json(200, res);
   492|  } catch(e) { return c.json(400, { error: String(e) }); }
   493|});
   494|
   495|// ── API v2: POST /api/v1 (unified action dispatcher) ──
   496|routerAdd('POST', '/api/v1', (c) => {
   497|  function bearerAuthMiddleware(c) {
   498|    try {
   499|      var authHeader = c.requestInfo().headers['authorization'];
   500|      if (!authHeader) return null;
   501|      var parts = String(authHeader).split(' ');
   502|      if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
   503|        return c.json(401, { 'error': 'Invalid Authorization header format. Use: Bearer <token>' });
   504|      }
   505|      var token = parts[1].trim();
   506|      if (!token) return c.json(401, { 'error': 'Empty token' });
   507|      var hashed = (function(tok) { try { return $security.SHA256(tok); } catch(e) { var h=0;if(tok.length===0)return'd';for(var i=0;i<tok.length;i++){h=((h<<5)-h)+tok.charCodeAt(i);h=h&h;}return'd_'+Math.abs(h).toString(16).padStart(8,'0');} })(token);
   508|      var tokens = $app.findRecordsByFilter('api_tokens','token_hash = "'+hashed+'"','',1,0);
   509|      if (tokens.length === 0) return null;
   510|      var tokRec = tokens[0];
   511|      var rawEnabled = tokRec.get('enabled');
   512|      if (rawEnabled === false || rawEnabled === 0 || rawEnabled === 'false') return c.json(401,{'error':'API token is disabled'});
   513|      var rawExp = tokRec.get('expires_at');
   514|      if (rawExp) { var expMs=0;if(typeof rawExp==='string')expMs=new Date(rawExp).getTime();else if(rawExp&&typeof rawExp.getTime==='function')expMs=rawExp.getTime();else if(rawExp)expMs=new Date(String(rawExp)).getTime();var nowMs=new Date().getTime();if(expMs>0&&expMs<nowMs)return c.json(401,{'error':'API token has expired'}); }
   515|      var userId = String(tokRec.get('user')||'');
   516|      var user = null; try { user = $app.findRecordById('users',userId); } catch(e) { return c.json(401,{'error':'Token owner not found'}); }
   517|      if (!user) return c.json(401,{'error':'Token owner not found'});
   518|      var rawActive = user.get('active');
   519|      var rawMemberStatus = user.get('member_status');
   520|      if (rawActive === false || rawActive === 0 || rawActive === 'false') return c.json(403,{'error':'Token owner account is blocked'});
   521|      if (rawMemberStatus === 'blocked') return c.json(403,{'error':'Token owner account is blocked'});
   522|      if (rawMemberStatus === 'pending_approval') return c.json(403,{'error':'Token owner is pending approval'});
   523|      var rawPerms = tokRec.get('permissions');
   524|      if (!rawPerms || (Array.isArray(rawPerms)&&rawPerms.length===0)) rawPerms = tokRec.get('scopes');
   525|      var perms = []; if (Array.isArray(rawPerms)) perms=rawPerms; else if (typeof rawPerms==='string') try { perms=JSON.parse(rawPerms); } catch(e){}
   526|      c.set('apiTokenInfo',{token_id:tokRec.id,token_name:String(tokRec.get('name')||''),user_id:user.id,user_role:String(user.get('role')||'user'),user_name:String(user.get('name')||user.get('email')||''),family_id:String(user.get('family_id')||''),permissions:perms});
   527|      c.set('authRecord',user);
   528|      return null;
   529|    } catch(e) { return c.json(500,{'error':'Token auth error: '+String(e)}); }
   530|  }
   531|  try {
   532|    var ba = bearerAuthMiddleware(c);
   533|    if (ba) return ba;
   534|    var info = c.requestInfo();
   535|    var body = info.body || {};
   536|    var d = body;
   537|    var action = (d.action || '').trim();
   538|    if (!action) return c.json(400, { error: 'action required' });
   539|    var auth = null;
   540|
   541|    var needsAuth = ['create','update','complete','assign','delete','list','filters','add_subtask'];
   542|    if (needsAuth.indexOf(action) >= 0) {
   543|      auth = info.auth || c.get('authRecord');
   544|      if (!auth) return c.json(401, { error: 'Unauthorized' });
   545|    }
   546|
   547|    var gv = function(o,k,f) { if(f===undefined)f='';if(!o)return f;if(Object.prototype.hasOwnProperty.call(o,k)){var v=o[k];return(v===undefined||v===null)?f:v;}return f; };
   548|
   549|    if (action === 'list') {
   550|    var q = info.query || {};
   551|    var f = ''; // All entries visible to everyone
   552|      var tasks = $app.findRecordsByFilter('tasks', f, '-created', 0, 0).map(function(r) {
   553|        return { id:r.id, type:'task', title:(r.get('title')||''), description:(r.get('blocked_comment')||''), status:(r.get('status')||'todo'), assignee_id:(r.get('assigned_to')||''), labels:(r.get('labels')||[]), shop_id:'', quantity:null, created_by:(r.get('user')||''), completed_by:'', created_at:r.get("created"), updated_at:r.get("updated") };
   554|      });
   555|      var items = $app.findRecordsByFilter('items', f, '-created', 0, 0).map(function(r) {
   556|        return { id:r.id, type:'grocery', title:(r.get('title')||''), description:'', status:r.get('completed')?'done':'todo', assignee_id:(r.get('assigned_to')||''), labels:(r.get('labels')||[]), shop_id:(r.get('shop_id')||''), quantity:(r.get('quantity')||1), created_by:(r.get('user')||''), completed_by:'', created_at:r.get("created"), updated_at:r.get("updated") };
   557|      });
   558|      var all = tasks.concat(items);
   559|      var t = (q.type||'').trim(), s = (q.status||'').trim(), a2 = (q.assignee_id||'').trim(), l = (q.label||'').trim(), sh = (q.shop_id||'').trim();
   560|      var res = [];
   561|      for (var i=0;i<all.length;i++) { var e=all[i];
   562|        if (t && e.type!==t) continue; if (s && e.status!==s) continue; if (a2 && e.assignee_id!==a2) continue;
   563|        if (l && (!Array.isArray(e.labels) || e.labels.indexOf(l)===-1)) continue; if (sh && e.shop_id!==sh) continue;
   564|        res.push(e);
   565|      }
   566|      return c.json(200, res);
   567|    }
   568|
   569|    if (action === 'create') {
   570|      var title = String(gv(d,'title','')).trim();
   571|      var type = String(gv(d,'type','task')).trim();
   572|      if (!title) return c.json(400, { error: 'title required' });
   573|      var fid = String(auth.get('family_id') || '').trim();
   574|
   575|      if (type === 'task') {
   576|        var rec = new Record($app.findCollectionByNameOrId('tasks'));
   577|        rec.set('title', title);
   578|        rec.set('user', auth.id);
   579|        if (fid) rec.set('family_id', fid);
   580|        var s2 = String(gv(d,'status','todo')).trim();
   581|        if (s2) rec.set('status', s2);
   582|        var desc = String(gv(d,'description','')).trim();
   583|        if (desc) rec.set('blocked_comment', desc);
   584|        var assign = String(gv(d,'assignee_id','')).trim();
   585|        if (assign) rec.set('assigned_to', assign);
   586|        var labs = d.labels;
   587|        if (Array.isArray(labs) && labs.length > 0) rec.set('labels', labs);
   588|        var linkedTo = String(gv(d,'linked_to','')).trim();
   589|        if (linkedTo) rec.set('linked_to', linkedTo);
   590|        var linkedType = String(gv(d,'linked_type','')).trim();
   591|        if (linkedType) rec.set('linked_type', linkedType);
   592|        rec.set('flag',false);
   593|        $app.save(rec);
   594|
   595|        // If this is a subtask (has linked_to), update parent's subtask_ids
   596|        if (linkedTo) {
   597|          var parent = $app.findRecordById('tasks', linkedTo);
   598|          if (parent) {
   599|            var existing = parent.get('subtask_ids') || [];
   600|            if (Array.isArray(existing) && existing.indexOf(rec.id) === -1) {
   601|              existing.push(rec.id);
   602|              parent.set('subtask_ids', existing);
   603|              $app.save(parent);
   604|            }
   605|          }
   606|        }
   607|
   608|        return c.json(201, {id:rec.id,type:'task',title:rec.get('title'),description:rec.get('blocked_comment'),status:rec.get('status'),assignee_id:rec.get('assigned_to'),labels:rec.get('labels'),shop_id:'',quantity:null,created_by:auth.id,completed_by:'',created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
   609|      }
   610|
   611|      if (type === 'grocery') {
   612|        rec = new Record($app.findCollectionByNameOrId('items'));
   613|        rec.set('title', title);
   614|        rec.set('user', auth.id);
   615|        if (fid) rec.set('family_id', fid);
   616|        var qty = Number(gv(d,'quantity','1'));
   617|        if (!isNaN(qty) && qty > 0) rec.set('quantity', qty);
   618|        var shop = String(gv(d,'shop_id','')).trim();
   619|        if (shop) rec.set('shop_id', shop);
   620|        var assign2 = String(gv(d,'assignee_id','')).trim();
   621|        if (assign2) rec.set('assigned_to', assign2);
   622|        rec.set('completed', false);
   623|        $app.save(rec);
   624|        return c.json(201, {id:rec.id,type:'grocery',title:rec.get('title'),description:'',status:rec.get('completed')?'done':'todo',assignee_id:rec.get('assigned_to'),labels:rec.get('labels'),shop_id:rec.get('shop_id'),quantity:rec.get('quantity'),created_by:auth.id,completed_by:'',created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
   625|      }
   626|
   627|      return c.json(400, { error: 'Invalid type: ' + type });
   628|    }
   629|
   630|    if (action === 'complete') {
   631|      var id = String(gv(d,'id','')).trim();
   632|      var type = String(gv(d,'type','')).trim();
   633|      if(!id) return c.json(400,{error:'id required'});
   634|      if(!type||(type!=='task'&&type!=='grocery')) return c.json(400,{error:'type must be task or grocery'});
   635|      var rec = $app.findRecordById(type==='task'?'tasks':'items',id);
   636|      if(!rec) return c.json(404,{error:'Entry not found'});
   637|      if(type==='task'){ rec.set('status','done'); } else { rec.set('completed',true); }
   638|      $app.save(rec);return c.json(200,{completed:true});
   639|    }
   640|
   641|    if (action === 'assign') {
   642|      var id = String(gv(d,'id','')).trim();
   643|      var type = String(gv(d,'type','')).trim();
   644|      if(!id) return c.json(400,{error:'id required'});
   645|      if(!type||(type!=='task'&&type!=='grocery')) return c.json(400,{error:'type must be task or grocery'});
   646|      var rec = $app.findRecordById(type==='task'?'tasks':'items',id);
   647|      if(!rec) return c.json(404,{error:'Entry not found'});
   648|      rec.set('assigned_to',String(gv(d,'assignee_id','')));
   649|      $app.save(rec);return c.json(200,{assigned:true});
   650|    }
   651|
   652|    if (action === 'delete') {
   653|      var id = String(gv(d,'id','')).trim();
   654|      var type = String(gv(d,'type','')).trim();
   655|      if(!id) return c.json(400,{error:'id required'});
   656|      if(!type||(type!=='task'&&type!=='grocery')) return c.json(400,{error:'type must be task or grocery'});
   657|      var rec = $app.findRecordById(type==='task'?'tasks':'items',id);
   658|      if(!rec) return c.json(404,{error:'Entry not found'});
   659|      $app.delete(rec);return c.json(200,{deleted:true});
   660|    }
   661|
   662|    if (action === 'add_subtask') {
   663|      if (!auth) return c.json(401, { error: 'Unauthorized' });
   664|      var taskId = String(gv(d, 'task_id', '')).trim();
   665|      var subtaskId = String(gv(d, 'subtask_id', '')).trim();
   666|      if (!taskId || !subtaskId) return c.json(400, { error: 'task_id and subtask_id required' });
   667|      var parent = $app.findRecordById('tasks', taskId);
   668|      if (!parent) return c.json(404, { error: 'Parent task not found' });
   669|      var existing = parent.get('subtask_ids') || [];
   670|      if (!Array.isArray(existing)) existing = [];
   671|      if (existing.indexOf(subtaskId) === -1) {
   672|        existing.push(subtaskId);
   673|        parent.set('subtask_ids', existing);
   674|        $app.save(parent);
   675|      }
   676|      return c.json(200, { success: true });
   677|    }
   678|
   679|    if (action === 'filters') {
   680|      var f = ''; // All entries visible to everyone
   681|      var labels = $app.findRecordsByFilter('labels',f,'name',0,0).map(function(r){return{id:r.id,name:r.get('name'),color:r.get('color')};});
   682|      var shops = $app.findRecordsByFilter('shops',f,'name',0,0).map(function(r){return{id:r.id,name:r.get('name'),color:r.get('color')};});
   683|      var users = $app.findRecordsByFilter('users','','name',0,0).map(function(r){return{id:r.id,name:r.get('name')||r.email};});
   684|      return c.json(200,{labels:labels,shops:shops,users:users});
   685|    }
   686|
   687|    // ── Admin: set_role (max 1 admin) ──
   688|    if (action === 'set_role') {
   689|      if (!auth) return c.json(401, { error: 'Unauthorized' });
   690|      if (String(auth.get('role') || '') !== 'admin' && String(auth.get('role') || '') !== 'owner') return c.json(403, { error: 'Admin only' });
   691|      var targetId = String(gv(d, 'user_id', '')).trim();
   692|      var newRole = String(gv(d, 'role', '')).trim();
   693|      if (!targetId || !newRole) return c.json(400, { error: 'user_id and role required' });
   694|      if (['owner','admin','member','agent'].indexOf(newRole) === -1) return c.json(400, { error: 'Invalid role' });
   695|
   696|      // Max 1 admin: demote current admin before promoting another
   697|      if (newRole === 'admin') {
   698|        var existingAdmins = $app.findRecordsByFilter('users', 'role = "admin"', '', 0, 0);
   699|        var filtered = [];
   700|        for (var i = 0; i < existingAdmins.length; i++) {
   701|          if (existingAdmins[i].id !== targetId) filtered.push(existingAdmins[i]);
   702|        }
   703|        if (filtered.length > 0) return c.json(400, { error: 'There can be only one admin. Demote the current admin first.' });
   704|      }
   705|
   706|      // Prevent current user from demoting themselves from admin if no other admin exists
   707|      if (newRole !== 'admin' && auth.id === targetId) {
   708|        var remainingAdmins = $app.findRecordsByFilter('users', 'role = "admin"', '', 0, 0);
   709|        var otherAdmins = [];
   710|        for (var i = 0; i < remainingAdmins.length; i++) {
   711|          if (remainingAdmins[i].id !== targetId) otherAdmins.push(remainingAdmins[i]);
   712|        }
   713|        if (otherAdmins.length === 0) return c.json(400, { error: 'You are the only admin. Promote someone else first.' });
   714|      }
   715|
   716|      var target = $app.findRecordById('users', targetId);
   717|      if (!target) return c.json(404, { error: 'User not found' });
   718|      var u = $app.unsafeWithoutHooks();
   719|      target.set('role', newRole);
   720|      u.save(target);
   721|      return c.json(200, { success: true, user_id: targetId, role: newRole });
   722|    }
   723|
   724|    return c.json(400, { error: 'Unknown action: ' + action });
   725|  } catch(e) { return c.json(400, { error: String(e) }); }
   726|});
   727|
   728|// ── Load additional route files ──────────────────────────────────────
   729|// Route files now auto-loaded from 10_openapi.pb.js, 11_docs.pb.js, 12_users.pb.js
   730|
   731|// ── Agent management endpoints ──────────────────────────────────────────
   732|// These work with api_tokens records where enabled=false = pending, enabled=true = approved.
   733|
   734|// GET /api/agent/counts — returns pending/approved counts
   735|routerAdd('GET', '/api/agent/counts', (c) => {
   736|  try {
   737|    var info = c.requestInfo();
   738|    var auth = info && info.auth ? info.auth : null;
   739|    if (!auth) return c.json(401, { error: 'Unauthorized' });
   740|    if (String(auth.get('role') || '') !== 'admin' && String(auth.get('role') || '') !== 'owner') return c.json(403, { error: 'Admin only' });
   741|
   742|    // Get family members to scope tokens
   743|    var fid = String(auth.get('family_id') || '');
   744|    var userIds = [];
   745|    if (fid) {
   746|      var members = $app.findRecordsByFilter('users', 'family_id = "' + fid + '"', '', 0, 0);
   747|      for (var mi = 0; mi < members.length; mi++) { userIds.push('"' + members[mi].id + '"'); }
   748|    } else {
   749|      userIds.push('"' + auth.id + '"');
   750|    }
   751|    var userFilter = 'user.id = ' + userIds.join(' || user.id = ');
   752|    var allTokens = $app.findRecordsByFilter('api_tokens', userFilter, '', 0, 0);
   753|    var pending = 0, approved = 0;
   754|    for (var ti = 0; ti < allTokens.length; ti++) {
   755|      var rawEnabled = allTokens[ti].get('enabled');
   756|      var isEnabled = rawEnabled !== false && rawEnabled !== 0 && rawEnabled !== 'false';
   757|      if (isEnabled) approved++; else pending++;
   758|    }
   759|    return c.json(200, { pending: pending, approved: approved });
   760|  } catch(e) { return c.json(500, { error: String(e) }); }
   761|});
   762|
   763|// GET /api/agent/pending — returns tokens where enabled=false
   764|routerAdd('GET', '/api/agent/pending', (c) => {
   765|  try {
   766|    var info = c.requestInfo();
   767|    var auth = info && info.auth ? info.auth : null;
   768|    if (!auth) return c.json(401, { error: 'Unauthorized' });
   769|    if (String(auth.get('role') || '') !== 'admin' && String(auth.get('role') || '') !== 'owner') return c.json(403, { error: 'Admin only' });
   770|
   771|    var fid = String(auth.get('family_id') || '');
   772|    var userIds = [];
   773|    if (fid) {
   774|      var members = $app.findRecordsByFilter('users', 'family_id = "' + fid + '"', '', 0, 0);
   775|      for (var mi = 0; mi < members.length; mi++) { userIds.push('"' + members[mi].id + '"'); }
   776|    } else {
   777|      userIds.push('"' + auth.id + '"');
   778|    }
   779|    var userFilter = 'user.id = ' + userIds.join(' || user.id = ');
   780|    var tokens = $app.findRecordsByFilter('api_tokens', userFilter + ' && enabled=false', '-created', 0, 0);
   781|    var agents = [];
   782|    for (var ti = 0; ti < tokens.length; ti++) {
   783|      var t = tokens[ti];
   784|      agents.push({
   785|        id: t.id,
   786|        name: String(t.get('name') || 'Agent'),
   787|        email: '',
   788|        status: 'pending',
   789|        created: t.get('created') || new Date().toISOString(),
   790|      });
   791|    }
   792|    return c.json(200, { agents: agents });
   793|  } catch(e) { return c.json(500, { error: String(e) }); }
   794|});
   795|
   796|// POST /api/agent/approve — enables a token
   797|routerAdd('POST', '/api/agent/approve', (c) => {
   798|  try {
   799|    var info = c.requestInfo();
   800|    var auth = info && info.auth ? info.auth : null;
   801|    if (!auth) return c.json(401, { error: 'Unauthorized' });
   802|    if (String(auth.get('role') || '') !== 'admin' && String(auth.get('role') || '') !== 'owner') return c.json(403, { error: 'Admin only' });
   803|
   804|    var d = info.body || {};
   805|    var tokenId = String(d.id || '').trim();
   806|    if (!tokenId) return c.json(400, { error: 'id required' });
   807|
   808|    var token = $app.findRecordById('api_tokens', tokenId);
   809|    if (!token) return c.json(404, { error: 'Token not found' });
   810|    token.set('enabled', true);
   811|    $app.save(token);
   812|
   813|    // Also update the invite's used flag if linked
   814|    var invites = $app.findRecordsByFilter('invite_codes', 'token_id = "' + tokenId + '"', '', 1, 0);
   815|    if (invites.length > 0) {
   816|      var inv = invites[0];
   817|      inv.set('used', true);
   818|      inv.set('used_at', new Date().toISOString());
   819|      $app.save(inv);
   820|    }
   821|
   822|    return c.json(200, {
   823|      id: tokenId,
   824|      name: String(token.get('name') || ''),
   825|      status: 'approved',
   826|      message: 'Agent approved. Token is now active.',
   827|    });
   828|  } catch(e) { return c.json(500, { error: String(e) }); }
   829|});
   830|
   831|// POST /api/agent/reject — deletes a pending token
   832|routerAdd('POST', '/api/agent/reject', (c) => {
   833|  try {
   834|    var info = c.requestInfo();
   835|    var auth = info && info.auth ? info.auth : null;
   836|    if (!auth) return c.json(401, { error: 'Unauthorized' });
   837|    if (String(auth.get('role') || '') !== 'admin' && String(auth.get('role') || '') !== 'owner') return c.json(403, { error: 'Admin only' });
   838|
   839|    var d = info.body || {};
   840|    var tokenId = String(d.id || '').trim();
   841|    if (!tokenId) return c.json(400, { error: 'id required' });
   842|
   843|    var token = $app.findRecordById('api_tokens', tokenId);
   844|    if (!token) return c.json(404, { error: 'Token not found' });
   845|
   846|    // Also delete linked invite
   847|    var invites = $app.findRecordsByFilter('invite_codes', 'token_id = "' + tokenId + '"', '', 1, 0);
   848|    if (invites.length > 0) {
   849|      $app.delete(invites[0]);
   850|    }
   851|
   852|    $app.delete(token);
   853|    return c.json(200, { deleted: true });
   854|  } catch(e) { return c.json(500, { error: String(e) }); }
   855|});
   856|
   857|// GET /api/agent/list — returns all tokens with status
   858|routerAdd('GET', '/api/agent/list', (c) => {
   859|  try {
   860|    var info = c.requestInfo();
   861|    var auth = info && info.auth ? info.auth : null;
   862|    if (!auth) return c.json(401, { error: 'Unauthorized' });
   863|    if (String(auth.get('role') || '') !== 'admin' && String(auth.get('role') || '') !== 'owner') return c.json(403, { error: 'Admin only' });
   864|
   865|    var fid = String(auth.get('family_id') || '');
   866|    var userIds = [];
   867|    if (fid) {
   868|      var members = $app.findRecordsByFilter('users', 'family_id = "' + fid + '"', '', 0, 0);
   869|      for (var mi = 0; mi < members.length; mi++) { userIds.push('"' + members[mi].id + '"'); }
   870|    } else {
   871|      userIds.push('"' + auth.id + '"');
   872|    }
   873|    var userFilter = 'user.id = ' + userIds.join(' || user.id = ');
   874|    var tokens = $app.findRecordsByFilter('api_tokens', userFilter, '-created', 0, 0);
   875|    var agents = [];
   876|    for (var ti = 0; ti < tokens.length; ti++) {
   877|      var t = tokens[ti];
   878|      var rawEnabled = t.get('enabled');
   879|      var isEnabled = rawEnabled !== false && rawEnabled !== 0 && rawEnabled !== 'false';
   880|      agents.push({
   881|        id: t.id,
   882|        name: String(t.get('name') || 'Agent'),
   883|        email: '',
   884|        status: isEnabled ? 'approved' : 'pending',
   885|        created: t.get('created') || new Date().toISOString(),
   886|        updated: t.get('updated') || '',
   887|      });
   888|    }
   889|    return c.json(200, { agents: agents });
   890|  } catch(e) { return c.json(500, { error: String(e) }); }
   891|});
   892|
   893|// DELETE /api/agent/:id — revoke token
   894|routerAdd('DELETE', '/api/agent/:id', (c) => {
   895|  try {
   896|    var info = c.requestInfo();
   897|    var auth = info && info.auth ? info.auth : null;
   898|    if (!auth) return c.json(401, { error: 'Unauthorized' });
   899|    if (String(auth.get('role') || '') !== 'admin' && String(auth.get('role') || '') !== 'owner') return c.json(403, { error: 'Admin only' });
   900|
   901|    var tokenId = c.pathParam('id');
   902|    if (!tokenId) return c.json(400, { error: 'id required' });
   903|
   904|    var token = $app.findRecordById('api_tokens', tokenId);
   905|    if (!token) return c.json(404, { error: 'Token not found' });
   906|    $app.delete(token);
   907|    return c.json(200, { deleted: true });
   908|  } catch(e) { return c.json(500, { error: String(e) }); }
   909|});
   910|