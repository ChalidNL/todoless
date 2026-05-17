/// <reference path="../pb_data/types.d.ts" />

// PB 0.34 JS hooks: 
// - function/var declarations don't hoist into callbacks — inline helpers per handler
// - c.requestInfo() call ONCE per request
// - use info.auth NOT info.authRecord
// - path params via routerAdd(':param') don't work — use body/query for IDs

routerAdd('GET', '/api/todoless/hook-health', (c) => c.json(200, { ok: true }));

// ── Create invite code (server-side, bypasses PB API rules) ──
routerAdd('POST', '/api/todoless/invites/create', (c) => {
  try {
    var info = c.requestInfo();
    var auth = info && info.auth ? info.auth : null;
    if (!auth) return c.json(401, { error: 'Unauthorized' });

    // Generate 6-digit code
    var code = '';
    var digits = '0123456789';
    for (var i = 0; i < 6; i++) {
      code += digits.charAt(Math.floor(Math.random() * digits.length));
    }

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
    if (existing.length === 0 || !setupDone) {
      // BOOTSTRAP WINDOW — no invite required until setup is completed
      if (!d.email || !d.password || d.password.length < 8) return c.json(400, { error: 'Email and password (min 8) required' });
      if (d.password !== d.passwordConfirm) return c.json(400, { error: 'Passwords do not match' });
      var uc = $app.findCollectionByNameOrId('users');
      var rec = new Record(uc);
      rec.set('email', d.email); rec.set('password', d.password);
      rec.set('passwordConfirm', d.passwordConfirm);
      rec.set('name', d.name || d.email.split('@')[0]);
      rec.set('role', 'admin'); rec.set('family_id', ''); rec.set('emailVisibility', true);
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

    // SUBSEQUENT USER — require valid invite
    var ic = String(d.invite_code || '').trim().toUpperCase();
    if (!ic) throw new BadRequestError('Invite code required for registration.', {});
    var now = new Date().toISOString();
    var invites = $app.findRecordsByFilter('invite_codes', 'code="' + ic + '"&&used=false&&expires_at>"' + now + '"', '-created', 1, 0);
    if (invites.length === 0) throw new BadRequestError('Invalid or expired invite code.', {});
    var inviter = $app.findRecordById('users', String(invites[0].get('user') || ''));
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
    rec.set('family_id', fid); rec.set('emailVisibility', true);
    $app.save(rec);

    // Mark invite as used — disabled for now: same invite can be shared
    // var inv = invites[0];
    // inv.set('used', true); inv.set('used_at', new Date().toISOString()); inv.set('used_by', rec.id);
    // $app.save(inv);

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
    var needsAuth = ['create','update','complete','assign','delete','list','filters'];
    if (needsAuth.indexOf(action) >= 0) {
      auth = info.auth;
      if (!auth) return c.json(401, { error: 'Unauthorized' });
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
      if(fid){users=$app.findRecordsByFilter('users','family_id = "'+fid+'"','name',0,0).map(function(r){return{id:r.id,name:r.get('name')||r.email};});}
      return c.json(200,{labels:labels,shops:shops,users:users});
    }

    return c.json(400, { error: 'Unknown action: ' + action });
  } catch(e) { return c.json(400, { error: String(e) }); }
});
