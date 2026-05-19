/// <reference path="../pb_data/types.d.ts" />

// PB 0.34 JS hooks: 
// - function/var declarations don't hoist into callbacks — inline helpers per handler
// - c.requestInfo() call ONCE per request
// - use info.auth NOT info.authRecord
// - path params via routerAdd(':param') don't work — use body/query for IDs

routerAdd('GET', '/api/todoless/hook-health', (c) => c.json(200, { ok: true }));

routerAdd('GET', '/api/todoless/openapi.json', (c) => {
  var spec = {
    openapi: '3.0.3',
    info: {
      title: 'TodoLess API',
      version: '1.0.0',
      description: 'Public and authenticated endpoints for TodoLess agentic integrations.'
    },
    servers: [{ url: '/' }],
    tags: [
      { name: 'public', description: 'No auth required' },
      { name: 'auth', description: 'Bearer token required' },
      { name: 'admin', description: 'Admin role required for specific actions' }
    ],
    paths: {
      '/api/todoless/hook-health': { get: { tags:['public'], summary:'Hook health', responses:{ '200': { description:'OK' } } } },
      '/api/todoless/setup-status': { get: { tags:['public'], summary:'Setup bootstrap status', responses:{ '200': { description:'Status payload' } } } },
      '/api/todoless/validate-invite': { get: { tags:['public'], summary:'Validate invite code', parameters:[{name:'code',in:'query',required:true,schema:{type:'string'}}], responses:{ '200': { description:'Invite valid' }, '400': {description:'Invite invalid'} } } },
      '/api/todoless/register': { post: { tags:['public'], summary:'Register user', requestBody:{ required:true, content:{ 'application/json': { schema:{ type:'object', properties:{ email:{type:'string'}, password:{type:'string'}, passwordConfirm:{type:'string'}, name:{type:'string'}, invite_code:{type:'string'}, user_type:{type:'string', enum:['family_member','family_assistant']} }, required:['email','password','passwordConfirm','name'] } } } }, responses:{ '201':{description:'User created'}, '400':{description:'Validation error'} } } },
      '/api/todoless/auth-with-password': { post: { tags:['public'], summary:'Authenticate with email/password', requestBody:{ required:true, content:{ 'application/json': { schema:{ type:'object', properties:{ email:{type:'string'}, password:{type:'string'} }, required:['email','password'] } } } }, responses:{ '200':{description:'Token + user'}, '400':{description:'Auth failed'} } } },
      '/api/todoless/invites/create': { post: { tags:['auth','admin'], summary:'Create invite code', security:[{ bearerAuth: [] }], responses:{ '200':{description:'Invite created'}, '401':{description:'Unauthorized'}, '403':{description:'Admin only'} } } },
      '/api/todoless/entries': { get: { tags:['auth'], summary:'Unified entries feed', security:[{ bearerAuth: [] }], responses:{ '200':{description:'Entries list'}, '401':{description:'Unauthorized'} } } },
      '/api/todoless/api': {
        post: {
          tags:['auth'],
          summary:'Unified action dispatcher',
          description:'Write actions require Bearer auth. Admin-only actions: set_role, set_user_block, delete_user.',
          security:[{ bearerAuth: [] }],
          requestBody:{ required:true, content:{ 'application/json': { schema:{ type:'object', properties:{ action:{type:'string'}, data:{type:'object'} }, required:['action'] } } } },
          responses:{ '200':{description:'Action result'}, '201':{description:'Created'}, '400':{description:'Invalid request'}, '401':{description:'Unauthorized'}, '403':{description:'Forbidden'} }
        }
      }
    },
    components: {
      securitySchemes: {
        bearerAuth: { type:'http', scheme:'bearer', bearerFormat:'JWT' }
      }
    }
  };
  return c.json(200, spec);
});

routerAdd('GET', '/api/todoless/swagger', (c) => {
  var html = "<!doctype html><html><head><meta charset='utf-8'><title>TodoLess API Docs</title><link rel='stylesheet' href='https://unpkg.com/swagger-ui-dist@5/swagger-ui.css'></head><body><div id='swagger-ui'></div><script src='https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js'></script><script>window.ui = SwaggerUIBundle({url:'/api/todoless/openapi.json',dom_id:'#swagger-ui'});</script></body></html>";
  c.response.header().set('Content-Type', 'text/html; charset=utf-8');
  return c.html(200, html);
});

// ── Create invite code (server-side, bypasses PB API rules) ──
routerAdd('POST', '/api/todoless/invites/create', (c) => {
  try {
    var info = c.requestInfo();
    var auth = info && info.auth ? info.auth : null;
    if (!auth) return c.json(401, { error: 'Unauthorized' });

    // Generate UNIQUE 6-digit code (avoid active duplicate codes)
    var digits = '0123456789';
    var code = '';
    var attempts = 0;
    var nowMs = new Date().getTime();
    var maxAttempts = 25;
    while (attempts < maxAttempts) {
      attempts += 1;
      code = '';
      for (var i = 0; i < 6; i++) code += digits.charAt(Math.floor(Math.random() * digits.length));

      var existingCode = $app.findRecordsByFilter('invite_codes', 'code="' + code + '"', '-created', 1, 0);
      if (existingCode.length === 0) break;

      var r0 = existingCode[0];
      var used0 = !!r0.get('used');
      var raw0 = r0.get('expires_at');
      var exp0 = 0;
      if (typeof raw0 === 'string') exp0 = new Date(raw0).getTime();
      else if (raw0 && typeof raw0.getTime === 'function') exp0 = raw0.getTime();
      else if (raw0) exp0 = new Date(String(raw0)).getTime();

      // Reuse code only if previous invite is terminal (used or expired)
      if (used0 || (exp0 > 0 && exp0 <= nowMs)) break;
    }

    if (!code) return c.json(500, { error: 'Failed to generate invite code. Retry.' });

    var now = new Date();
    var expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    var coll = $app.findCollectionByNameOrId('invite_codes');
    var rec = new Record(coll);
    rec.set('code', code);
    rec.set('expires_at', expiresAt.toISOString());
    rec.set('used', false);
    rec.set('user', auth.id);
    $app.save(rec);

    return c.json(201, {
      id: rec.id,
      code: code,
      created_by: auth.id,
      expires_at: expiresAt.toISOString(),
      used: false,
    });
  } catch (e) {
    return c.json(500, { error: String(e) });
  }
});

routerAdd('GET', '/api/todoless/setup-status', (c) => {
  try {
    var u = $app.findRecordsByFilter('users', '', '-created', 1, 0);
    var s = $app.findRecordsByFilter('app_settings', 'setup_complete = true', '-created', 1, 0);
    return c.json(200, { has_users: u.length > 0, setup_complete: s.length > 0 });
  } catch(e) { return c.json(200, { has_users: false, setup_complete: false }); }
});

// ── Validate invite code (no auth required, public) ──
routerAdd('GET', '/api/todoless/validate-invite', (c) => {
  try {
    var q = c.requestInfo().query || {};
    var code = String(q.code || '').trim().toUpperCase();
    if (!code) return c.json(400, { status: 'error', message: 'code required' });

    var now = new Date().getTime();
    var invites = $app.findRecordsByFilter('invite_codes', 'code="' + code + '"', '-created', 1, 0);

    if (invites.length === 0) return c.json(200, { status: 'not_found', message: 'Invite code not found' });

    var inv = invites[0];
    var used = inv.get('used') || false;
    var expiresAt = inv.get('expires_at');
    var expiryTime = 0;
    if (typeof expiresAt === 'string') {
      expiryTime = new Date(expiresAt).getTime();
    } else if (expiresAt && typeof expiresAt.getTime === 'function') {
      expiryTime = expiresAt.getTime();
    } else if (expiresAt) {
      // Goja/PB 0.34: try converting to string first
      expiryTime = new Date(String(expiresAt)).getTime();
    }
    var isExpired = expiryTime > 0 && expiryTime < now;

    if (used) return c.json(200, { status: 'used', message: 'Invite code has already been used' });
    if (isExpired) return c.json(200, { status: 'expired', message: 'Invite code has expired' });

    // Get inviter info
    var inviterId = String(inv.get('user') || '');
    var inviter = null;
    try {
      if (inviterId) {
        var r = $app.findRecordById('users', inviterId);
        inviter = { id: r.id, name: r.get('name') || String(r.get('email')||'') };
      }
    } catch(e) {}

    return c.json(200, {
      status: 'valid',
      message: 'Invite code is valid',
      invite: {
        id: inv.id,
        code: inv.get('code'),
        created_by: inviterId,
        inviter: inviter,
      }
    });
  } catch(e) { return c.json(500, { status: 'error', message: String(e) }); }
});

// ── User registration (no auth required) ──
routerAdd('POST', '/api/todoless/register', (c) => {
  try {
    var info = c.requestInfo();
    var d = info.data || info.body || {};
    var userType = String(d.user_type || 'family_member').trim();
    // Validate user_type
    if (['family_member', 'family_assistant'].indexOf(userType) === -1) {
      return c.json(400, { error: 'Invalid user_type. Must be family_member or family_assistant.' });
    }

    var existing = $app.findRecordsByFilter('users', '', '-created', 1, 0);
    var setupDone = $app.findRecordsByFilter('app_settings', 'setup_complete = true', '-created', 1, 0).length > 0;
    if (!d.email || !d.password || d.password.length < 8) return c.json(400, { error: 'Email and password (min 8) required' });
    if (d.password !== d.passwordConfirm) return c.json(400, { error: 'Passwords do not match' });

    // FIRST USER ONLY: bootstrap admin + family
    if (existing.length === 0) {
      var uc = $app.findCollectionByNameOrId('users');
      var rec = new Record(uc);
      rec.set('email', d.email); rec.set('password', d.password);
      rec.set('passwordConfirm', d.passwordConfirm);
      rec.set('name', d.name || d.email.split('@')[0]);
      rec.set('role', 'admin'); rec.set('family_id', ''); rec.set('emailVisibility', true); rec.set('active', true);
      $app.save(rec);
      var fc = $app.findCollectionByNameOrId('families');
      var fam = new Record(fc);
      fam.set('name', d.family_name || 'My Family');
      fam.set('created_by', rec.id); $app.save(fam);
      rec.set('family_id', fam.id); $app.save(rec);
      return c.json(201, {
        user: { id: rec.id, email: String(rec.get('email')||''), name: String(rec.get('name')||''), role: 'admin', family_id: fam.id }
      });
    }

    // BOOTSTRAP WINDOW: before setup_complete, allow registration without invite,
    // but NEVER create additional admins.
    if (!setupDone) {
      var seedUser = existing[0];
      var fidBootstrap = seedUser ? String(seedUser.get('family_id') || '') : '';
      if (!fidBootstrap) throw new BadRequestError('Bootstrap family not ready. Please retry.', {});

      var ucBootstrap = $app.findCollectionByNameOrId('users');
      var recBootstrap = new Record(ucBootstrap);
      recBootstrap.set('email', d.email); recBootstrap.set('password', d.password);
      recBootstrap.set('passwordConfirm', d.passwordConfirm);
      recBootstrap.set('name', d.name || d.email.split('@')[0]);
      var roleBootstrap = userType === 'family_assistant' ? 'assistant' : 'user';
      recBootstrap.set('role', roleBootstrap);
      recBootstrap.set('family_id', fidBootstrap);
      recBootstrap.set('emailVisibility', true);
      recBootstrap.set('active', true);
      $app.save(recBootstrap);
      return c.json(201, {
        user: { id: recBootstrap.id, email: String(recBootstrap.get('email')||''), name: String(recBootstrap.get('name')||''), role: roleBootstrap, family_id: fidBootstrap }
      });
    }

    // SUBSEQUENT USER — require valid, single-use invite
    var ic = String(d.invite_code || '').trim().toUpperCase();
    if (!ic) throw new BadRequestError('Invite code required for registration.', {});

    var invites = $app.findRecordsByFilter('invite_codes', 'code="' + ic + '"', '-created', 1, 0);
    if (invites.length === 0) throw new BadRequestError('Invite code not found.', {});

    var inv = invites[0];
    var used = !!inv.get('used');
    if (used) throw new BadRequestError('Invite code has already been used.', {});

    var rawExp = inv.get('expires_at');
    var expMs = 0;
    if (typeof rawExp === 'string') expMs = new Date(rawExp).getTime();
    else if (rawExp && typeof rawExp.getTime === 'function') expMs = rawExp.getTime();
    else if (rawExp) expMs = new Date(String(rawExp)).getTime();

    var nowMs = new Date().getTime();
    var isExpired = expMs > 0 && expMs <= nowMs;
    if (isExpired) throw new BadRequestError('Invite code has expired.', {});

    var inviterId = String(inv.get('user') || '');
    if (!inviterId) throw new BadRequestError('Invite code is invalid (missing inviter).', {});

    var inviter = $app.findRecordById('users', inviterId);
    var fid = inviter ? String(inviter.get('family_id') || '') : '';
    if (!fid) throw new BadRequestError('Inviter has no family — ask admin to create one.', {});

    var uc = $app.findCollectionByNameOrId('users');
    var rec = new Record(uc);
    rec.set('email', d.email); rec.set('password', d.password);
    rec.set('passwordConfirm', d.passwordConfirm);
    rec.set('name', d.name || d.email.split('@')[0]);

    // Set role based on user_type
    var role = userType === 'family_assistant' ? 'assistant' : 'user';
    rec.set('role', role);
    rec.set('family_id', fid); rec.set('emailVisibility', true); rec.set('active', true);
    $app.save(rec);

    // Mark invite as used to prevent reuse
    inv.set('used', true);
    $app.save(inv);

    return c.json(201, {
      user: { id: rec.id, email: String(rec.get('email')||''), name: String(rec.get('name')||''), role: role, family_id: fid }
    });
  } catch(e) { return c.json(400, { error: String(e) }); }
});

// ── Entries: LIST (GET) ──
routerAdd('GET', '/api/todoless/entries', (c) => {
  try {
    var info = c.requestInfo();
    var auth = info && info.auth ? info.auth : null;
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    var q = info.query || {};
    var fid = String(auth.get('family_id') || '').trim();
    var f = fid ? 'user.family_id = "' + fid + '"' : 'user = "' + auth.id + '"';
    var tasks = $app.findRecordsByFilter('tasks', f, '-created', 0, 0).map(function(r) {
      return { id:r.id, type:'task', title: (r.get('title')||''), description: (r.get('blocked_comment')||''), status: (r.get('status')||'todo'), assignee_id: (r.get('assigned_to')||''), labels: (r.get('labels')||[]), shop_id:'', quantity:null, created_by: (r.get('user')||''), completed_by:'', created_at: r.created, updated_at: r.updated };
    });
    var items = $app.findRecordsByFilter('items', f, '-created', 0, 0).map(function(r) {
      return { id:r.id, type:'grocery', title: (r.get('title')||''), description:'', status: r.get('completed')?'done':'todo', assignee_id: (r.get('assigned_to')||''), labels: (r.get('labels')||[]), shop_id: (r.get('shop_id')||''), quantity: (r.get('quantity')||1), created_by: (r.get('user')||''), completed_by:'', created_at: r.created, updated_at: r.updated };
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

// ── API v2: POST /api/todoless/api (unified action dispatcher) ──
routerAdd('POST', '/api/todoless/api', (c) => {
  try {
    var info = c.requestInfo();
    var body = info.data || info.body || {};
    var d = body;
    var action = (d.action || '').trim();
    if (!action) return c.json(400, { error: 'action required' });
    var auth = null;

    // Auth check — use info.auth (PB 0.34: c.auth is null without middleware)
    var needsAuth = ['create','update','complete','assign','delete','list','filters','set_role','set_user_block','delete_user'];
    if (needsAuth.indexOf(action) >= 0) {
      auth = info.auth;
      if (!auth) return c.json(401, { error: 'Unauthorized' });

      // Enforce blocked users cannot use authenticated API routes
      var authFresh = $app.findRecordById('users', auth.id);
      if (!authFresh) return c.json(401, { error: 'Unauthorized' });
      var rawActive = authFresh.get('active');
      var isBlocked = (rawActive === false || rawActive === 0 || rawActive === 'false');
      if (isBlocked) return c.json(403, { error: 'Account is blocked' });
      auth = authFresh;
    }

    // Helper for safe field access (must be inside callback for PB 0.34 scope)
    var gv = function(o,k,f) { if(f===undefined)f='';if(!o)return f;if(Object.prototype.hasOwnProperty.call(o,k)){var v=o[k];return(v===undefined||v===null)?f:v;}return f; };

    if (action === 'list') {
      var q = info.query || {};
      var fid = String(auth.get('family_id') || '').trim();
      var f = fid ? 'user.family_id = "' + fid + '"' : 'user = "' + auth.id + '"';
      var tasks = $app.findRecordsByFilter('tasks', f, '-created', 0, 0).map(function(r) {
        return { id:r.id, type:'task', title:(r.get('title')||''), description:(r.get('blocked_comment')||''), status:(r.get('status')||'todo'), assignee_id:(r.get('assigned_to')||''), labels:(r.get('labels')||[]), shop_id:'', quantity:null, created_by:(r.get('user')||''), completed_by:'', created_at:r.created, updated_at:r.updated };
      });
      var items = $app.findRecordsByFilter('items', f, '-created', 0, 0).map(function(r) {
        return { id:r.id, type:'grocery', title:(r.get('title')||''), description:'', status:r.get('completed')?'done':'todo', assignee_id:(r.get('assigned_to')||''), labels:(r.get('labels')||[]), shop_id:(r.get('shop_id')||''), quantity:(r.get('quantity')||1), created_by:(r.get('user')||''), completed_by:'', created_at:r.created, updated_at:r.updated };
      });
      var all = tasks.concat(items);
      var t=(q.type||'').trim(),s=(q.status||'').trim(),a=(q.assignee_id||'').trim(),l=(q.label||'').trim(),sh=(q.shop_id||'').trim();
      var res = [];
      for (var i=0;i<all.length;i++) { var e=all[i];
        if(t&&e.type!==t)continue;if(s&&e.status!==s)continue;if(a&&e.assignee_id!==a)continue;
        if(l&&(!Array.isArray(e.labels)||e.labels.indexOf(l)===-1))continue;if(sh&&e.shop_id!==sh)continue;
        res.push(e);
      }
      return c.json(200, res);
    }

    if (action === 'create') {
      var type = String(gv(d,'type','')).trim();
      var title = String(gv(d,'title','')).trim();
      if (!type || (type!=='task'&&type!=='grocery')) return c.json(400, { error: 'type must be task or grocery' });
      if (!title) return c.json(400, { error: 'title required' });
      if (type==='task') {
        var rec = new Record($app.findCollectionByNameOrId('tasks'));
        var rs = String(gv(d,'status','todo')||'todo');
        var st = ['backlog','todo','in_progress','done'].indexOf(rs)>=0?rs:'todo';
        if (st==='in_progress') st='todo';
        rec.set('user',auth.id);rec.set('title',title);rec.set('status',st);
        rec.set('blocked_comment',String(gv(d,'description','')||''));
        rec.set('assigned_to',gv(d,'assignee_id',''));rec.set('labels',gv(d,'labels',[]));
        rec.set('is_private',false);rec.set('completed_at',st==='done'?new Date().toISOString():null);
        rec.set('flag',false);$app.save(rec);
        return c.json(201,{id:rec.id,type:'task',title:rec.get('title')||'',description:rec.get('blocked_comment')||'',status:rec.get('status')||'todo',assignee_id:rec.get('assigned_to')||'',labels:rec.get('labels')||[],shop_id:'',quantity:null,created_by:rec.get('user')||'',completed_by:'',created_at:rec.created,updated_at:rec.updated});
      }
      rec = new Record($app.findCollectionByNameOrId('items'));
      rec.set('user',auth.id);rec.set('title',title);rec.set('completed',String(gv(d,'status','todo')||'todo')==='done');
      rec.set('assigned_to',gv(d,'assignee_id',''));rec.set('labels',gv(d,'labels',[]));
      rec.set('shop_id',gv(d,'shop_id',''));rec.set('quantity',gv(d,'quantity',1));rec.set('is_private',false);
      $app.save(rec);
      return c.json(201,{id:rec.id,type:'grocery',title:rec.get('title')||'',description:'',status:rec.get('completed')?'done':'todo',assignee_id:rec.get('assigned_to')||'',labels:rec.get('labels')||[],shop_id:rec.get('shop_id')||'',quantity:rec.get('quantity')||1,created_by:rec.get('user')||'',completed_by:'',created_at:rec.created,updated_at:rec.updated});
    }

    if (action === 'update') {
      var id = String(gv(d,'id','')).trim();
      var type = String(gv(d,'type','')).trim();
      if (!id) return c.json(400, { error: 'id required' });
      if (!type||(type!=='task'&&type!=='grocery')) return c.json(400,{error:'type must be task or grocery'});
      var rec = $app.findRecordById(type==='task'?'tasks':'items',id);
      if (!rec) return c.json(404,{error:'Entry not found'});
      if(Object.prototype.hasOwnProperty.call(d,'title')) rec.set('title',gv(d,'title',''));
      if(Object.prototype.hasOwnProperty.call(d,'assignee_id')) rec.set('assigned_to',gv(d,'assignee_id',''));
      if(Object.prototype.hasOwnProperty.call(d,'labels')) rec.set('labels',gv(d,'labels',[]));
      if(type==='task') {
        if(Object.prototype.hasOwnProperty.call(d,'description')) rec.set('blocked_comment',gv(d,'description',''));
        if(Object.prototype.hasOwnProperty.call(d,'status')){var sr=String(gv(d,'status','todo'));if(sr==='in_progress')sr='todo';rec.set('status',sr);rec.set('completed_at',sr==='done'?new Date().toISOString():null);}
        $app.save(rec);return c.json(200,{id:rec.id,type:'task',title:rec.get('title'),description:rec.get('blocked_comment'),status:rec.get('status'),assignee_id:rec.get('assigned_to'),labels:rec.get('labels'),shop_id:'',quantity:null,created_by:rec.get('user'),completed_by:'',created_at:rec.created,updated_at:rec.updated});
      }
      if(Object.prototype.hasOwnProperty.call(d,'status')) rec.set('completed',String(gv(d,'status','todo'))==='done');
      if(Object.prototype.hasOwnProperty.call(d,'shop_id')) rec.set('shop_id',gv(d,'shop_id',''));
      if(Object.prototype.hasOwnProperty.call(d,'quantity')) rec.set('quantity',gv(d,'quantity',1));
      $app.save(rec);return c.json(200,{id:rec.id,type:'grocery',title:rec.get('title'),description:'',status:rec.get('completed')?'done':'todo',assignee_id:rec.get('assigned_to'),labels:rec.get('labels'),shop_id:rec.get('shop_id'),quantity:rec.get('quantity'),created_by:rec.get('user'),completed_by:'',created_at:rec.created,updated_at:rec.updated});
    }

    if (action === 'complete') {
      var id = String(gv(d,'id','')).trim();
      var type = String(gv(d,'type','')).trim();
      var complete = String(gv(d,'complete','true'))!=='false';
      if (!id) return c.json(400,{error:'id required'});
      if(!type||(type!=='task'&&type!=='grocery')) return c.json(400,{error:'type must be task or grocery'});
      var rec = $app.findRecordById(type==='task'?'tasks':'items',id);
      if(!rec) return c.json(404,{error:'Entry not found'});
      if(type==='task'){rec.set('status',complete?'done':'todo');rec.set('completed_at',complete?new Date().toISOString():null);}
      else{rec.set('completed',complete);}
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

    if (action === 'filters') {
      var fid = String(auth.get('family_id')||'').trim();
      var f = fid?'user.family_id = "'+fid+'"':'user = "'+auth.id+'"';
      var labels = $app.findRecordsByFilter('labels',f,'name',0,0).map(function(r){return{id:r.id,name:r.get('name'),color:r.get('color')};});
      var shops = $app.findRecordsByFilter('shops',f,'name',0,0).map(function(r){return{id:r.id,name:r.get('name'),color:r.get('color')};});
      var users = [];
      if(fid){users=$app.findRecordsByFilter('users','family_id = "'+fid+'"','name',0,0).map(function(r){return{id:r.id,name:r.get('name')||String(r.get('email')||''),role:r.get('role')||'user',active:!!r.get('active')};});}
      return c.json(200,{labels:labels,shops:shops,users:users});
    }

    if (action === 'set_user_block') {
      var blockActorRole = String(auth.get('role') || 'user');
      if (blockActorRole !== 'admin') return c.json(403, { error: 'Admin only' });

      var blockTargetId = String(gv(d,'user_id','')).trim();
      var blockValueRaw = gv(d,'blocked',true);
      var shouldBlock = blockValueRaw === true || String(blockValueRaw) === 'true' || String(blockValueRaw) === '1';
      if (!blockTargetId) return c.json(400, { error: 'user_id required' });
      if (blockTargetId === auth.id) return c.json(409, { error: 'cannot block yourself' });

      var blockActorFamilyId = String(auth.get('family_id') || '');
      var blockTarget = $app.findRecordById('users', blockTargetId);
      if (!blockTarget) return c.json(404, { error: 'user not found' });
      var blockTargetFamilyId = String(blockTarget.get('family_id') || '');
      if (!blockActorFamilyId || blockActorFamilyId !== blockTargetFamilyId) return c.json(403, { error: 'cross-family block denied' });

      var blockTargetRole = String(blockTarget.get('role') || 'user');
      if (blockTargetRole === 'admin' && shouldBlock) return c.json(409, { error: 'cannot block admin account' });

      blockTarget.set('active', shouldBlock ? false : true);
      $app.save(blockTarget);
      return c.json(200, { ok: true, user: { id: blockTarget.id, active: !!blockTarget.get('active') } });
    }

    if (action === 'delete_user') {
      var delActorRole = String(auth.get('role') || 'user');
      if (delActorRole !== 'admin') return c.json(403, { error: 'Admin only' });

      var delTargetId = String(gv(d,'user_id','')).trim();
      if (!delTargetId) return c.json(400, { error: 'user_id required' });
      if (delTargetId === auth.id) return c.json(409, { error: 'cannot delete yourself' });

      var delActorFamilyId = String(auth.get('family_id') || '');
      var delTarget = $app.findRecordById('users', delTargetId);
      if (!delTarget) return c.json(404, { error: 'user not found' });
      var delTargetFamilyId = String(delTarget.get('family_id') || '');
      if (!delActorFamilyId || delActorFamilyId !== delTargetFamilyId) return c.json(403, { error: 'cross-family delete denied' });

      var delTargetRole = String(delTarget.get('role') || 'user');
      if (delTargetRole === 'admin') return c.json(409, { error: 'cannot delete admin account' });

      // Transfer ownership to acting admin to prevent FK constraint issues.
      var transferCollections = ['tasks','items','notes','labels','shops','rewards','goals','projects','reminders','calendar_events','invite_codes'];
      for (var tc = 0; tc < transferCollections.length; tc++) {
        var collName = transferCollections[tc];
        var owned = [];
        try {
          owned = $app.findRecordsByFilter(collName, 'user = "' + delTargetId + '"', '-created', 0, 0);
        } catch (_eOwned) {
          owned = [];
        }
        for (var oi = 0; oi < owned.length; oi++) {
          owned[oi].set('user', auth.id);
          $app.save(owned[oi]);
        }
      }

      // Clear assignee references in task/item records.
      var assignedTasks = [];
      try { assignedTasks = $app.findRecordsByFilter('tasks', 'assigned_to = "' + delTargetId + '"', '-created', 0, 0); } catch (_eTasks) { assignedTasks = []; }
      for (var ti = 0; ti < assignedTasks.length; ti++) {
        assignedTasks[ti].set('assigned_to', '');
        $app.save(assignedTasks[ti]);
      }
      var assignedItems = [];
      try { assignedItems = $app.findRecordsByFilter('items', 'assigned_to = "' + delTargetId + '"', '-created', 0, 0); } catch (_eItems) { assignedItems = []; }
      for (var ii = 0; ii < assignedItems.length; ii++) {
        assignedItems[ii].set('assigned_to', '');
        $app.save(assignedItems[ii]);
      }

      $app.delete(delTarget);
      return c.json(200, { ok: true, deleted_user_id: delTargetId });
    }

    if (action === 'set_role') {
      var roleActor = String(auth.get('role') || 'user');
      if (roleActor !== 'admin') return c.json(403, { error: 'Admin only' });

      var targetId = String(gv(d,'user_id','')).trim();
      var nextRole = String(gv(d,'role','')).trim();
      if (!targetId) return c.json(400, { error: 'user_id required' });
      if (['admin','user','assistant','child'].indexOf(nextRole) === -1) return c.json(400, { error: 'invalid role' });

      var actorFamilyId = String(auth.get('family_id') || '');
      var target = $app.findRecordById('users', targetId);
      if (!target) return c.json(404, { error: 'user not found' });
      var targetFamilyId = String(target.get('family_id') || '');
      if (!actorFamilyId || actorFamilyId !== targetFamilyId) return c.json(403, { error: 'cross-family role change denied' });

      var admins = $app.findRecordsByFilter('users', 'family_id = "' + actorFamilyId + '" && role = "admin"', '-created', 0, 0);
      var targetCurrentRole = String(target.get('role') || 'user');

      // single-admin: no second admin
      if (nextRole === 'admin') {
        var otherAdmins = admins.filter(function(u){ return u.id !== target.id; });
        if (otherAdmins.length > 0) return c.json(409, { error: 'single-admin enforced: family already has an admin' });
      }

      // single-admin: cannot demote last admin
      if (targetCurrentRole === 'admin' && nextRole !== 'admin') {
        var adminCount = admins.length;
        if (adminCount <= 1) return c.json(409, { error: 'cannot demote last admin' });
      }

      target.set('role', nextRole);
      $app.save(target);
      return c.json(200, { ok: true, user: { id: target.id, role: String(target.get('role')||'user') } });
    }

    return c.json(400, { error: 'Unknown action: ' + action });
  } catch(e) { return c.json(400, { error: String(e) }); }
});
