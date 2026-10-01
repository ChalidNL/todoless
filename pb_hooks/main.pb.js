/// <reference path="../pb_data/types.d.ts" />

// PB 0.34 JS hooks: 
// - function/var declarations don't hoist into callbacks — inline helpers per handler
// - c.requestInfo() call ONCE per request
// - use info.body NOT info.data (PB 0.34 compat)
// - $app.save(rec) for users throws "ReferenceError: tasks" (PB 0.34.2 bug)
//   FIX: use $app.save(rec) with manual id/tokenKey



// ── Canonical Record Hooks: single creation path for ALL sources (UI, API, agent) ──
//
// PocketBase >= 0.23 record hooks take (handler, ...collectionTags) and the
// handler MUST call e.next() for the save to go ahead. The previous
// (collectionName, handler) order silently registered nothing — none of the
// defaults below applied and the GH#79 date sync never ran (the function
// source became the "tag", so the hook never matched a collection).
//
// These are MODEL-level hooks on purpose: they fire for every persist path
// ($app.save() from /api/v1, /api/tasks, agent routes, other hooks) as well as
// the native collection API. That also means there is NO request context here
// (e.requestInfo does not exist on model events) — "what changed" comes from
// e.record.original(), the pre-update snapshot.

onRecordCreate((e) => {
  var rec = e.record;
  // #241: only a top-level task can be a parent (no self-links, no cycles).
  var parentError = require(__hooks + '/lib/task-parent.js').parentLinkError(rec, function (id) {
    try { return $app.findRecordById('tasks', id); } catch (_e) { return null; }
  });
  if (parentError) throw new BadRequestError(parentError);
  var dateSync = require(__hooks + '/lib/task-date-sync.js');
  // Canonical defaults — always applied, no outer try/catch: a failure here
  // must fail the save rather than persist a half-initialised task.
  if (!rec.get('status')) rec.set('status', 'todo');
  if (rec.get('flag') === undefined || rec.get('flag') === null) rec.set('flag', false);
  if (rec.get('is_private') === undefined || rec.get('is_private') === null) rec.set('is_private', false);
  if (rec.get('focus') === undefined || rec.get('focus') === null) rec.set('focus', false);
  if (rec.get('all_day') === undefined || rec.get('all_day') === null) rec.set('all_day', false);
  // GH#79: start_time := due_date canonical default. Must use hasDate() —
  // empty PB date fields are truthy DateTime zero objects, so the old
  // `!rec.get('start_time')` truthiness check was dead code (GH#11).
  dateSync.ensureStartOnCreate(rec);
  // `label` (relation) is canonical; mirror it into the legacy `labels` JSON
  // field so older readers keep seeing the same ids.
  var createLabels = rec.get('label');
  if (!Array.isArray(createLabels)) createLabels = createLabels ? [String(createLabels)] : [];
  rec.set('labels', createLabels);
  rec.set('label', createLabels);
  // #224: one note, two fields (blocked_comment for the app/API, description
  // for ICS) — keep them identical.
  try { require(__hooks + '/lib/task-note.js').syncNoteOnCreate(rec); } catch (_errNote) { /* never block the save */ }
  e.next();
}, 'tasks');

onRecordCreate((e) => {
  var rec = e.record;
  // Canonical defaults — always applied, no outer try/catch
  if (rec.get('completed') === undefined || rec.get('completed') === null) rec.set('completed', false);
  if (!rec.get('quantity')) rec.set('quantity', 1);
  if (rec.get('is_private') === undefined || rec.get('is_private') === null) rec.set('is_private', false);
  e.next();
}, 'items');

onRecordUpdate((e) => {
  var rec = e.record;
  // #241: re-check the parent link whenever it changes.
  var prevLinkedTo = '';
  try { prevLinkedTo = String(rec.original().get('linked_to') || ''); } catch (_eOrig) { prevLinkedTo = ''; }
  if (String(rec.get('linked_to') || '') !== prevLinkedTo) {
    var parentErrorU = require(__hooks + '/lib/task-parent.js').parentLinkError(rec, function (id) {
      try { return $app.findRecordById('tasks', id); } catch (_e) { return null; }
    });
    if (parentErrorU) throw new BadRequestError(parentErrorU);
  }
  var orig = null;
  try { if (typeof rec.original === 'function') orig = rec.original(); } catch (_errOriginal) { orig = null; }
  if (orig) {
    // Neither mirroring nor the date sync may ever block a save.
    try {
      var dateSync = require(__hooks + '/lib/task-date-sync.js');
      var idList = function (v) {
        if (Array.isArray(v)) return v.map(function (x) { return String(x); });
        return v ? [String(v)] : [];
      };
      // Legacy `labels` is a JSON field: record.get() yields raw bytes in the
      // JSVM, so read it through getString() + JSON.parse.
      var legacyLabels = function (r) {
        try { var parsed = JSON.parse(r.getString('labels') || 'null'); return Array.isArray(parsed) ? parsed.map(String) : []; } catch (_e) { return []; }
      };
      var newLabel = idList(rec.get('label')), oldLabel = idList(orig.get('label'));
      var newLabels = legacyLabels(rec), oldLabels = legacyLabels(orig);
      if (JSON.stringify(newLabel) !== JSON.stringify(oldLabel)) {
        rec.set('labels', newLabel);                       // canonical relation changed → mirror
      } else if (JSON.stringify(newLabels) !== JSON.stringify(oldLabels)) {
        rec.set('label', newLabels);                       // legacy client wrote `labels` only
      }

      // GH#79: keep start_time/end_time in agreement with due_date changes
      // (task list and API clients only ever send due_date). The sync lib
      // expects the request-body view ("which keys were sent"); rebuild it
      // from the diff against the original so it works for every persist path.
      var msOrNull = function (v) { var m = dateSync.toMs(v); return isNaN(m) ? null : m; };
      var changed = {};
      var newDueMs = msOrNull(rec.get('due_date'));
      if (newDueMs !== msOrNull(orig.get('due_date'))) changed.due_date = newDueMs === null ? null : new Date(newDueMs).toISOString();
      if (msOrNull(rec.get('start_time')) !== msOrNull(orig.get('start_time'))) changed.start_time = rec.get('start_time');
      if (msOrNull(rec.get('end_time')) !== msOrNull(orig.get('end_time'))) changed.end_time = rec.get('end_time');
      if (Object.prototype.hasOwnProperty.call(changed, 'due_date')) dateSync.syncOnDueDateChange(rec, changed, orig);

      // #224: keep blocked_comment and description identical.
      require(__hooks + '/lib/task-note.js').syncNoteOnUpdate(rec, orig);
    } catch (_errSync) { /* never block the save */ }
  }
  e.next();
}, 'tasks');

// ─── Public API endpoints ────────────────────────────────────────────────

// Health endpoint for container healthchecks. Unlike /api/health this route only
// exists if pb_hooks loaded successfully, and the cheap DB probe additionally
// fails on a locked/corrupt database. Succeeds on a fresh (empty users) instance.
routerAdd('GET', '/api/hook-health', (c) => {
  try {
    $app.findRecordsByFilter('users', 'id != ""', '', 1, 0);
    return c.json(200, { ok: true });
  } catch (err) {
    return require(__hooks + '/lib/errors.js').respondError(c, err, 500, 'Internal server error', { ok: false });
  }
});

// ── Version endpoint — returns deployment info for environment comparison ──
routerAdd('GET', '/api/version', (c) => {
  var env = 'unknown';
  var branch = 'unknown';
  var commit = 'unknown';
  var pb = 'unknown';
  try {
    var os = $os;
    env = String(os.getenv('DEPLOY_ENV') || 'unknown');
    branch = String(os.getenv('TODOLESS_BRANCH') || 'unknown');
    commit = String(os.getenv('COMMIT_SHA') || 'unknown');
    // Real PocketBase version. Newer PB releases expose app.version(); older
    // ones rely on the build-time PB_VERSION env (see Dockerfile.pocketbase).
    try {
      if (typeof $app.version === 'function') pb = String($app.version());
    } catch(e) { /* ignore */ }
    if (pb === 'unknown') pb = String(os.getenv('PB_VERSION') || 'unknown');
  } catch(e) { /* os not available */ }
  return c.json(200, {
    branch: branch,
    commit: commit,
    env: env,
    pb: pb,
    note: 'See GitHub releases for full changelog'
  });
});

// ─── Route helpers ──
// Legacy pb_hooks/routes/* and pb_hooks/cron/* were removed in GH#31 —
// PocketBase only loads root-level *.pb.js hooks, so those files were dead
// code. Shared Bearer token / API-key helpers live in pb_hooks/lib/auth.js
// (GH#30) — loaded via require(__hooks + '/lib/auth.js') from route callbacks.

// ── Create invite code (server-side, bypasses PB API rules) ──
// NOTE: authorization here is `role` (admin/owner) only, checked below.
// This codebase has no email-verification flow, and the `verified` field on
// the users collection is NOT used as an authorization gate anywhere -- do
// not assume it is a security control when touching this handler or others.
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
    var code = $security.randomString(12).toUpperCase();

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
    return require(__hooks + '/lib/errors.js').respondError(c, e, 500);
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
      id: invites[0].id,
      code: code,
      valid: true,
      status: 'valid',
      message: 'Invite code is valid',
      family_id: inviter ? String(inviter.get('family_id') || '') : '',
      family_name: familyName,
      invited_by: inviter ? String(inviter.get('name') || inviter.get('email') || '') : ''
    });
  } catch(e) { return require(__hooks + '/lib/errors.js').respondError(c, e, 500); }
});

// ── User registration (no auth required) ──
routerAdd('POST', '/api/register', (c) => {
  // Inline helper: create user with hooks bypass (PB 0.34 bug workaround)
  var createUser = function(txApp, col, data) {
    var u = txApp;
    var rec = new Record(col);
    rec.set('id', $security.randomString(15).toLowerCase());
    rec.set('tokenKey', $security.randomString(50));
    rec.set('verified', false);
    rec.set('email', data.email);
    rec.set('password', data.password);
    rec.set('passwordConfirm', data.passwordConfirm || data.password);
    rec.set('name', data.name || '');
    // Keep the structured name the onboarding/register forms collect (the
    // profile screen edits first/last name; previously only \`name\` was kept).
    rec.set('first_name', String(data.firstName || '').trim().slice(0, 100));
    rec.set('last_name', String(data.lastName || '').trim().slice(0, 100));
    rec.set('emailVisibility', false);
    rec.set('role', data.role || 'user');
    rec.set('family_id', data.family_id || '');
    rec.set('member_status', data.member_status || 'active');
    rec.set('member_type', data.member_type || 'family_member');
    rec.set('language', ['nl', 'fr', 'en', 'de', 'es'].indexOf(String(data.language || '')) !== -1 ? data.language : 'en');
    u.save(rec);
    return rec;
  };

  var createFamily = function(txApp, name, createdBy) {
    var fc = txApp.findCollectionByNameOrId('families');
    var fam = new Record(fc);
    fam.set('id', $security.randomString(15).toLowerCase());
    fam.set('name', name || 'My Family');
    fam.set('created_by', createdBy);
    txApp.save(fam);
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
    // GH#15 — the very first account bootstraps a brand-new family and must be
    // its admin. Agents can never hold admin/owner (see set_role's
    // "Agents cannot be assigned admin or owner roles" guard below), so
    // bootstrapping with user_type agent/family_assistant would strand the
    // family with no admin and no UI path to create one. Require a human
    // first; agents join afterwards via invite.
    if (shouldBootstrap && memberType === 'agent') {
      return c.json(400, { error: 'The first account must be a human user so the family has an admin. Register as a human first, then add agent accounts via invite.' });
    }
    if (shouldBootstrap) {
      // ── First user / setup flow ──
      if (!d.email || !d.password || d.password.length < 8) return c.json(400, { error: 'Email and password (min 8) required' });
      if (d.password !== d.passwordConfirm) return c.json(400, { error: 'Passwords do not match' });

      // Review S10: concurrent first registrations each saw "no users yet" and
      // each bootstrapped its own admin + family. The bootstrap now runs in
      // one transaction (PocketBase serialises write transactions) and
      // re-checks inside it, so exactly one wins.
      var created = null;
      $app.runInTransaction(function (txApp) {
        if (txApp.findRecordsByFilter('users', '', '-created', 1, 0).length > 0) {
          throw new BadRequestError('Registration requires a valid invite code once the first account exists.', {});
        }
        var uc = txApp.findCollectionByNameOrId('users');
        var rec = createUser(txApp, uc, {
          email: d.email,
          password: d.password,
          passwordConfirm: d.passwordConfirm,
          name: d.name || d.email.split('@')[0],
          firstName: d.firstName || d.first_name,
          lastName: d.lastName || d.last_name,
          role: (memberType === 'agent') ? 'member' : 'admin',
          family_id: '',
          member_status: 'active',
          member_type: memberType,
          language: d.language
        });
        var fam = createFamily(txApp, d.family_name || 'My Family', rec.id);
        rec.set('family_id', fam.id);
        txApp.save(rec);
        created = { rec: rec, fam: fam };
      });

      return c.json(201, {
        user: { id: created.rec.id, email: String(created.rec.get('email')||''), name: String(created.rec.get('name')||''), role: String(created.rec.get('role')||'member'), family_id: created.fam.id }
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
    // Review S10: a single-use invite could be redeemed by several parallel
    // registrations (each read used = false before any wrote it). Claim the
    // invite and create the account in one serialised transaction that
    // re-reads the invite first.
    var newUser = null;
    $app.runInTransaction(function (txApp) {
      var inviteRec = null;
      try { inviteRec = txApp.findRecordById('invite_codes', invites[0].id); } catch (_eInv) { inviteRec = null; }
      var stillOpen = inviteRec && inviteRec.get('used') !== true && inviteRec.get('used') !== 1 && String(inviteRec.get('used')) !== 'true';
      if (!stillOpen) throw new BadRequestError('Invalid or expired invite code.', {});
      var uc = txApp.findCollectionByNameOrId('users');
      var rec = createUser(txApp, uc, {
        email: d.email,
        password: d.password,
        passwordConfirm: d.passwordConfirm,
        name: d.name || d.email.split('@')[0],
        firstName: d.firstName || d.first_name,
        lastName: d.lastName || d.last_name,
        role: role,
        family_id: fid,
        member_status: 'active',
        member_type: memberType,
        language: d.language
      });
      inviteRec.set('used', true);
      inviteRec.set('used_at', now);
      inviteRec.set('used_by', rec.id);
      txApp.save(inviteRec);
      newUser = rec;
    });

    return c.json(201, {
      user: { id: newUser.id, email: String(newUser.get('email')||''), name: String(newUser.get('name')||''), role: role, family_id: fid }
    });
  } catch(e) { try { $app.logger().error('invite registration error: ' + String(e)); } catch(_e) {} return c.json(400, { error: 'Unable to register with invite code' }); }
});

// ── Entries: LIST (GET) ──
routerAdd('GET', '/api/entries', (c) => {
  var authLib = require(__hooks + '/lib/auth.js');
  var bearerAuthMiddleware = authLib.bearerAuthMiddleware;

try {
    var ba = bearerAuthMiddleware(c);
    if (ba) return ba;
    var info = c.requestInfo();
    var auth = (info && info.auth) || c.get('authRecord');
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    var memberStatus = '';
    try { memberStatus = String(auth.get('member_status') || ''); } catch (e) {}
    if (memberStatus === 'blocked') return c.json(403, { error: 'Account is blocked' });
    if (memberStatus === 'pending_approval') return c.json(403, { error: 'Account is pending approval' });
    var tokInfo = c.get('apiTokenInfo');
    function _hasPerm(req){ if(!tokInfo)return true; var ps=tokInfo.permissions||[]; for(var pi=0;pi<ps.length;pi++){var p=String(ps[pi]||''); if(p===req||p==='*')return true; var a=p.split(':'), b=req.split(':'); if(a.length===2&&b.length===2&&a[0]===b[0]&&a[1]==='*')return true;} return false; }
    if (!_hasPerm('entries:read') && !_hasPerm('tasks:read') && !_hasPerm('groceries:read')) return c.json(403, { error: 'Missing read permission' });
    // GH#28/#102: shared, batched, family-scoped listing with optional
    // pagination (pb_hooks/lib/entries.js).
    var listed = require(__hooks + '/lib/entries.js').listEntries(auth, info.query || {});
    return c.json(listed.status, listed.body);
  } catch(e) { return require(__hooks + '/lib/errors.js').respondError(c, e, 500); }
});

// ── API v2: POST /api/v1 (unified action dispatcher) ──
routerAdd('POST', '/api/v1', (c) => {
  var authLib = require(__hooks + '/lib/auth.js');
  var bearerAuthMiddleware = authLib.bearerAuthMiddleware;

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
      // GH#98 follow-up: member_status must be enforced on read/write paths, not
      // only on the companion endpoints. A blocked or pending-approval account
      // must not use the unified API even with a still-valid auth token.
      var ms = '';
      try { ms = String(auth.get('member_status') || ''); } catch (e) {}
      if (ms === 'blocked') return c.json(403, { error: 'Account is blocked' });
      if (ms === 'pending_approval') return c.json(403, { error: 'Account is pending approval' });
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
    function _canAccessTask(r){
      if(!r)return false; var taskOwner=String(r.get('user')||''); if(taskOwner===auth.id)return true;
      if(r.get('is_private')===true||r.get('is_private')===1||r.get('is_private')==='true')return false;
      var af=String(auth.get('family_id')||''); if(!af||!_canAccess(r))return false;
      var ids=r.get('label')||r.get('labels')||[]; if(!Array.isArray(ids))ids=ids?[String(ids)]:[];
      if(ids.length > 1){for(var mi=0;mi<ids.length;mi++){var mixedLabel=null;try{mixedLabel=$app.findRecordById('labels',String(ids[mi]||''));}catch(e){return false;}var mixedVis=String(mixedLabel.get('visibility')||(mixedLabel.get('is_private')?'private':'family'));if(mixedVis !== 'family')return false;}}
      for(var li=0;li<ids.length;li++){var labelId=String(ids[li]||'');if(!labelId)continue;var label=null;try{label=$app.findRecordById('labels',labelId);}catch(e){return false;}var vis=String(label.get('visibility')||(label.get('is_private')?'private':'family'));var owner=String(label.get('owner')||label.get('user')||'');var lf=String(label.get('family')||'');if(!lf&&owner){try{lf=String($app.findRecordById('users',owner).get('family_id')||'');}catch(e){return false;}}if(vis==='private'){if(owner!==auth.id)return false;}else if(vis==='shared'){var sw=label.get('shared_with')||[];if(!Array.isArray(sw))sw=sw?[String(sw)]:[];if(owner!==auth.id&&sw.indexOf(auth.id)===-1)return false;}else if(lf!==af)return false;}
      return true;
    }
    function _canAccessLabel(label){
      if(!label)return false;
      var owner=String(label.get('owner')||label.get('user')||''); if(owner===auth.id)return true;
      var af=String(auth.get('family_id')||''); if(!af)return false;
      var lf=String(label.get('family')||''); if(!lf&&owner){try{lf=String($app.findRecordById('users',owner).get('family_id')||'');}catch(e){return false;}}
      if(lf!==af)return false;
      var vis=String(label.get('visibility')||(label.get('is_private')?'private':'family'));
      if(vis==='family')return true;
      if(vis==='shared'){var sw=label.get('shared_with')||[];if(!Array.isArray(sw))sw=sw?[String(sw)]:[];return sw.indexOf(auth.id)!==-1;}
      return false;
    }
    function _freshAuth(){ if(!auth||!auth.id)return null; try { return $app.findRecordById('users', auth.id); } catch(e) { return null; } }
    function _isFamilyAdmin(user){ var r=String(user&&user.get('role')||''); return r==='admin'||r==='owner'; }

    // GH#17: an assignee must be an existing users record whose family_id
    // matches the auth user's family (or the auth user themself). Empty id
    // means "unassign" and is always valid.
    // #225: unknown ids are a 404, not a generic error from an unguarded
    // findRecordById.
    function _findEntry(type, id){ try { return $app.findRecordById(type==='task'?'tasks':'items', id); } catch(e) { return null; } }
    // #225: validated scalar fields accepted by create and update.
    var _PRIORITIES = ['low','medium','high'];
    var _taskStatus = require(__hooks + '/lib/task-status.js');
    var _TASK_STATUSES = _taskStatus.TASK_STATUSES;
    // 'in_progress' is accepted as an alias of 'todo' (same as the agents API).
    function _normStatus(v){ return _taskStatus.normalizeTaskStatus(v); }
    function _parseDue(v){
      if (v === null || v === '') return { ok: true, value: null };
      var dd = new Date(String(v));
      if (isNaN(dd.getTime())) return { ok: false };
      return { ok: true, value: dd.toISOString() };
    }
    function _validShop(id){
      if(!id)return true;
      var shopRec=null; try{ shopRec=$app.findRecordById('shops',String(id)); }catch(e){ return false; }
      var owner=String(shopRec.get('user')||''); if(owner===auth.id)return true;
      var af=String(auth.get('family_id')||''); if(!af||!owner)return false;
      try{ return String($app.findRecordById('users',owner).get('family_id')||'')===af; }catch(e){ return false; }
    }

    function _validAssignee(id){
      if(!id)return true;
      id=String(id);
      var authId=String(auth&&auth.id||'');
      if(id===authId)return true;
      var af=String(auth&&auth.get('family_id')||'');
      if(!af)return false;
      try{var u=$app.findRecordById('users',id);return !!u&&String(u.get('family_id')||'')===af;}catch(e){return false;}
    }

    if (action === 'list') {
      // GH#28/#102: same implementation as GET /api/entries. Filters and
      // pagination may come from the query string or the JSON body.
      var listQuery = {};
      var rawQuery = info.query || {};
      for (var qk in rawQuery) listQuery[qk] = rawQuery[qk];
      ['type', 'status', 'assignee_id', 'label', 'shop_id', 'updated_since', 'page', 'perPage'].forEach(function (k) {
        if (d && d[k] !== undefined && d[k] !== null) listQuery[k] = String(d[k]);
      });
      var listedV1 = require(__hooks + '/lib/entries.js').listEntries(auth, listQuery);
      return c.json(listedV1.status, listedV1.body);
    }

    if (action === 'create') {
      var title = String(gv(d,'title','')).trim();
      var type = String(gv(d,'type','task')).trim();
      if (!title) return c.json(400, { error: 'title required' });

      if (type === 'task') {
        var rec = new Record($app.findCollectionByNameOrId('tasks'));
        rec.set('title', title);
        rec.set('user', auth.id);
        var s2 = _normStatus(String(gv(d,'status','todo')).trim());
        if (s2 && _TASK_STATUSES.indexOf(s2) === -1) return c.json(400, {error:'Invalid status'});
        if (s2) rec.set('status', s2);
        if (d.priority !== undefined && d.priority !== null && d.priority !== '') {
          if (_PRIORITIES.indexOf(String(d.priority)) === -1) return c.json(400, {error:'Invalid priority'});
          rec.set('priority', String(d.priority));
        }
        if (d.due_date !== undefined) {
          var dueCreate = _parseDue(d.due_date);
          if (!dueCreate.ok) return c.json(400, {error:'Invalid due_date'});
          if (dueCreate.value) rec.set('due_date', dueCreate.value);
        }
        var desc = String(gv(d,'description','')).trim();
        if (desc) rec.set('blocked_comment', desc);
        var assign = String(gv(d,'assignee_id','')).trim();
        if (assign && !_validAssignee(assign)) return c.json(400, {error:'Invalid assignee'});
        if (assign) rec.set('assigned_to', assign);
        var labelCheck = authLib.validateLabelIdsForUser(d.labels, _freshAuth() || auth);
        if (!labelCheck.ok) return c.json(labelCheck.status, {error: labelCheck.error});
        var canonicalLabels = labelCheck.ids;
        rec.set('labels', canonicalLabels);
        rec.set('label', canonicalLabels);
        var linkedTo = String(gv(d,'linked_to','')).trim();
        // Only link under a parent the caller may access: the parent's
        // subtask_ids is written below (it used to accept any task id, even
        // one from another family).
        if (linkedTo) {
          var linkParent = null;
          try { linkParent = $app.findRecordById('tasks', linkedTo); } catch(e) {}
          if (!linkParent || !_canAccessTask(linkParent)) return c.json(404, {error:'Parent task not found'});
          rec.set('linked_to', linkedTo);
        }
        var linkedType = String(gv(d,'linked_type','')).trim();
        if (linkedType) rec.set('linked_type', linkedType);
        rec.set('flag',false);
        $app.save(rec);

        // If this is a subtask (has linked_to), update parent's subtask_ids.
        // subtask_ids is a JSON field — read it via lib/json-field.js, never
        // record.get() (raw bytes in the JSVM). An unknown parent id must not
        // turn the already-created task into a 500.
        if (linkedTo) {
          var parent = null;
          try { parent = $app.findRecordById('tasks', linkedTo); } catch(e) {}
          if (parent) {
            var existing = require(__hooks + '/lib/json-field.js').readIdArray(parent, 'subtask_ids');
            if (existing.indexOf(rec.id) === -1) {
              existing.push(rec.id);
              parent.set('subtask_ids', existing);
              $app.save(parent);
            }
          }
        }

        return c.json(201, {id:rec.id,type:'task',title:rec.get('title'),description:rec.get('blocked_comment'),priority:rec.get('priority')||'',due_date:rec.get('due_date')?String(rec.get('due_date')):'',status:rec.get('status'),assignee_id:rec.get('assigned_to'),labels:rec.get('labels'),shop_id:'',quantity:null,created_by:auth.id,completed_by:'',created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
      }

      if (type === 'grocery') {
        rec = new Record($app.findCollectionByNameOrId('items'));
        rec.set('title', title);
        rec.set('user', auth.id);
        var qty = Number(gv(d,'quantity','1'));
        if (!isNaN(qty) && qty > 0) rec.set('quantity', qty);
        var shop = String(gv(d,'shop_id','')).trim();
        if (shop && !_validShop(shop)) return c.json(400, {error:'Invalid shop'});
        if (shop) rec.set('shop_id', shop);
        var assign2 = String(gv(d,'assignee_id','')).trim();
        if (assign2 && !_validAssignee(assign2)) return c.json(400, {error:'Invalid assignee'});
        if (assign2) rec.set('assigned_to', assign2);
        if (d.priority !== undefined && d.priority !== null && d.priority !== '') {
          if (_PRIORITIES.indexOf(String(d.priority)) === -1) return c.json(400, {error:'Invalid priority'});
          rec.set('priority', String(d.priority));
        }
        if (d.due_date !== undefined) {
          var dueItem = _parseDue(d.due_date);
          if (!dueItem.ok) return c.json(400, {error:'Invalid due_date'});
          if (dueItem.value) rec.set('due_date', dueItem.value);
        }
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
      var rec = _findEntry(type, id);
      if(!rec) return c.json(404,{error:'Entry not found'});
      if (type === 'task' && !_canAccessTask(rec)) return c.json(404,{error:'Entry not found'});
      if(type!=='task' && !require(__hooks + '/lib/auth.js').canAccessItemForUser(rec, auth)) return c.json(404,{error:'Entry not found'});
      // #240: completed_by is whoever completes it, never the assignee.
      if(type==='task'){ if (String(rec.get('status')) !== 'done') rec.set('completed_by', auth.id); rec.set('status','done'); } else { rec.set('completed',true); }
      $app.save(rec);return c.json(200,{completed:true});
    }

    if (action === 'assign') {
      var id = String(gv(d,'id','')).trim();
      var type = String(gv(d,'type','')).trim();
      if(!id) return c.json(400,{error:'id required'});
      if(!type||(type!=='task'&&type!=='grocery')) return c.json(400,{error:'type must be task or grocery'});
      var rec = _findEntry(type, id);
      if(!rec) return c.json(404,{error:'Entry not found'});
      if (type === 'task' && !_canAccessTask(rec)) return c.json(404,{error:'Entry not found'});
      if(type!=='task' && !require(__hooks + '/lib/auth.js').canAccessItemForUser(rec, auth)) return c.json(404,{error:'Entry not found'});
      var assigneeVal = String(gv(d,'assignee_id',''));
      if (assigneeVal && !_validAssignee(assigneeVal)) return c.json(400,{error:'Invalid assignee'});
      rec.set('assigned_to',assigneeVal);
      $app.save(rec);return c.json(200,{assigned:true});
    }

    if (action === 'update') {
      var id = String(gv(d,'id','')).trim();
      var type = String(gv(d,'type','')).trim();
      if(!id) return c.json(400,{error:'id required'});
      if(!type||(type!=='task'&&type!=='grocery')) return c.json(400,{error:'type must be task or grocery'});
      var rec = _findEntry(type, id);
      if(!rec) return c.json(404,{error:'Entry not found'});
      if (type === 'task' && !_canAccessTask(rec)) return c.json(404,{error:'Entry not found'});
      if(type!=='task' && !require(__hooks + '/lib/auth.js').canAccessItemForUser(rec, auth)) return c.json(404,{error:'Entry not found'});
      var changed = [];
      if (d.title !== undefined) { rec.set('title', String(d.title)); changed.push('title'); }
      if (d.status !== undefined && type === 'task') { var stUpd = _normStatus(d.status); if (_TASK_STATUSES.indexOf(stUpd) === -1) return c.json(400,{error:'Invalid status'}); if (stUpd === 'done' && String(rec.get('status')) !== 'done') rec.set('completed_by', auth.id); else if (stUpd !== 'done') rec.set('completed_by', ''); rec.set('status', stUpd); changed.push('status'); }
      if (d.priority !== undefined) { var prUpd = d.priority === null ? '' : String(d.priority); if (prUpd && _PRIORITIES.indexOf(prUpd) === -1) return c.json(400,{error:'Invalid priority'}); rec.set('priority', prUpd); changed.push('priority'); }
      if (d.due_date !== undefined) { var dueUpd = _parseDue(d.due_date); if (!dueUpd.ok) return c.json(400,{error:'Invalid due_date'}); rec.set('due_date', dueUpd.value); changed.push('due_date'); }
      if (d.description !== undefined && type === 'task') { rec.set('blocked_comment', d.description === null ? '' : String(d.description)); changed.push('description'); }
      if (d.assignee_id !== undefined) { var assigneeUpd = d.assignee_id === null || d.assignee_id === '' ? '' : String(d.assignee_id); if (assigneeUpd && !_validAssignee(assigneeUpd)) return c.json(400,{error:'Invalid assignee'}); rec.set('assigned_to', assigneeUpd); changed.push('assignee_id'); }
      if (d.labels !== undefined && type === 'task') { var labelUpd = authLib.validateLabelIdsForUser(d.labels, _freshAuth() || auth); if (!labelUpd.ok) return c.json(labelUpd.status, {error: labelUpd.error}); rec.set('labels', labelUpd.ids); rec.set('label', labelUpd.ids); changed.push('labels'); }
      if (d.labels !== undefined && type !== 'task') { var ul = Array.isArray(d.labels) ? d.labels : (d.labels ? [String(d.labels)] : []); rec.set('labels', ul); changed.push('labels'); }
      if (type === 'grocery' && d.quantity !== undefined) { var qty = parseInt(d.quantity, 10); if (isNaN(qty) || qty < 1) qty = 1; rec.set('quantity', qty); changed.push('quantity'); }
      $app.save(rec);
      return c.json(200, { updated: true, id: rec.id, type: type, changed: changed });
    }

    if (action === 'delete') {
      var id = String(gv(d,'id','')).trim();
      var type = String(gv(d,'type','')).trim();
      if(!id) return c.json(400,{error:'id required'});
      if(!type||(type!=='task'&&type!=='grocery')) return c.json(400,{error:'type must be task or grocery'});
      var rec = _findEntry(type, id);
      if(!rec) return c.json(404,{error:'Entry not found'});
      if (type === 'task' && !_canAccessTask(rec)) return c.json(404,{error:'Entry not found'});
      if(type!=='task' && !require(__hooks + '/lib/auth.js').canAccessItemForUser(rec, auth)) return c.json(404,{error:'Entry not found'});
      $app.delete(rec);return c.json(200,{deleted:true});
    }

    if (action === 'add_subtask') {
      if (!auth) return c.json(401, { error: 'Unauthorized' });
      var taskId = String(gv(d, 'task_id', '')).trim();
      var subtaskId = String(gv(d, 'subtask_id', '')).trim();
      if (!taskId || !subtaskId) return c.json(400, { error: 'task_id and subtask_id required' });
      if (taskId === subtaskId) return c.json(400, { error: 'A task cannot be its own subtask' });
      // findRecordById throws on an unknown id — map that to 404 instead of a
      // generic 500 so clients can tell "gone" from "broken".
      var parent = null;
      try { parent = $app.findRecordById('tasks', taskId); } catch(e) {}
      if (!parent) return c.json(404, { error: 'Parent task not found' });
      if (!_canAccessTask(parent)) return c.json(404, { error: 'Parent task not found' });
      var child = null;
      try { child = $app.findRecordById('tasks', subtaskId); } catch(e) {}
      if (!child) return c.json(404, { error: 'Subtask not found' });
      if (!_canAccessTask(child)) return c.json(404, { error: 'Subtask not found' });
      // GH#88: write both sides in one transaction so the child's linked_to and
      // the parent's subtask_ids can never disagree on a partial failure.
      // PocketBase >= 0.23 exposes the transactional app directly (txApp.save /
      // txApp.findRecordById); the pre-0.23 dao()/saveRecord() API no longer exists.
      // subtask_ids is a JSON field: record.get() yields raw bytes in the JSVM,
      // so it must be read through lib/json-field.js (getString + JSON.parse).
      var jsonField = require(__hooks + '/lib/json-field.js');
      $app.runInTransaction(function(txApp) {
        var txParent = txApp.findRecordById('tasks', taskId);
        var txChild = txApp.findRecordById('tasks', subtaskId);
        if (String(txChild.get('linked_to') || '') !== String(taskId)) {
          txChild.set('linked_to', taskId);
          txChild.set('linked_type', 'task');
          txApp.save(txChild);
        }
        var existing = jsonField.readIdArray(txParent, 'subtask_ids');
        if (existing.indexOf(subtaskId) === -1) {
          existing.push(subtaskId);
          txParent.set('subtask_ids', existing);
          txApp.save(txParent);
        }
      });
      return c.json(200, { success: true });
    }

    if (action === 'filters') {
      var labels = $app.findRecordsByFilter('labels','', 'name',10000,0).filter(_canAccessLabel).map(function(r){return{id:r.id,name:r.get('name'),color:r.get('color')};});
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

      var familyAdmins = $app.findRecordsByFilter('users', 'family_id = {:familyId} && (role = "admin" || role = "owner")', '', 10000, 0, { familyId: actorFamilyId });
      var actorIsOwner = String(actorRoleRecord.get('role') || '') === 'owner';
      var currentOwner = null;
      for (var oi = 0; oi < familyAdmins.length; oi++) {
        if (String(familyAdmins[oi].get('role') || '') === 'owner') { currentOwner = familyAdmins[oi]; break; }
      }

      // The owner is the one role that cannot be demoted or blocked, so it is
      // never handed out by an admin: only the owner transfers ownership (and
      // becomes admin), and an admin may claim it only for a family that has
      // no owner at all (older installs, GH#23).
      if (newRole === 'owner' && currentOwner && !actorIsOwner) {
        return c.json(403, { error: 'Only the owner can transfer ownership' });
      }

      // Keep a single admin per family besides the owner: promoting a new
      // admin/owner demotes the other admins to member -- never the owner,
      // and on an ownership transfer the previous owner becomes admin.
      if (newRole === 'admin' || newRole === 'owner') {
        var u2 = $app;
        for (var i = 0; i < familyAdmins.length; i++) {
          var other = familyAdmins[i];
          if (other.id === targetId) continue;
          var otherIsOwner = String(other.get('role') || '') === 'owner';
          if (otherIsOwner && newRole !== 'owner') continue;
          other.set('role', otherIsOwner ? 'admin' : 'member');
          u2.save(other);
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

      var u = $app;
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
      var ub = $app;
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

      var counts = { transferred: {}, cascaded_private: {}, cleared: {}, cascaded_personal: {} };
      var retainedCollections = ['tasks', 'items', 'notes', 'labels', 'shops', 'calendar_events', 'sprints', 'invite_codes', 'rewards', 'goals', 'projects', 'reminders', 'briefings'];
      var personalCollections = ['app_settings', 'integrations', 'ai_settings', 'api_tokens', 'external_references', 'companion_devices'];

      function _hasField(collectionName, fieldName) {
        try {
          var collection = $app.findCollectionByNameOrId(collectionName);
          return !!collection.fields.getByName(fieldName);
        } catch (_) { return false; }
      }

      function _sameId(value, id) {
        return String(value || '') === id;
      }

      function _removeId(value, id) {
        if (!value) return value;
        if (Array.isArray(value)) {
          var next = [];
          for (var vi = 0; vi < value.length; vi++) {
            if (String(value[vi] || '') !== id) next.push(value[vi]);
          }
          return next;
        }
        return _sameId(value, id) ? '' : value;
      }

      function _recordsByUser(collectionName, userId) {
        try {
          $app.findCollectionByNameOrId(collectionName);
          return $app.findRecordsByFilter(collectionName, 'user = {:userId}', '', 10000, 0, { userId: userId });
        } catch (_) { return []; }
      }

      function _recordsByReference(collectionName, fieldName, userId) {
        try {
          $app.findCollectionByNameOrId(collectionName);
          if (!_hasField(collectionName, fieldName)) return [];
          var filter = fieldName + ' = {:userId}';
          if (fieldName === 'shared_with') filter = fieldName + ' ?= {:userId}';
          return $app.findRecordsByFilter(collectionName, filter, '', 10000, 0, { userId: userId });
        } catch (_) { return []; }
      }

      function _isPrivateRecord(collectionName, record) {
        if (collectionName === 'labels' && String(record.get('visibility') || '') === 'private') return true;
        var raw = record.get('is_private');
        return raw === true || raw === 1 || String(raw || '').toLowerCase() === 'true';
      }

      for (var rc = 0; rc < retainedCollections.length; rc++) {
        var retainName = retainedCollections[rc];
        var retained = _recordsByUser(retainName, targetIdDel);
        counts.transferred[retainName] = 0;
        counts.cascaded_private[retainName] = 0;
        for (var rr = 0; rr < retained.length; rr++) {
          if (_isPrivateRecord(retainName, retained[rr])) {
            counts.cascaded_private[retainName]++;
            continue;
          }
          retained[rr].set('user', actorDeleteRecord.id);
          if (retainName === 'labels') {
            if (_sameId(retained[rr].get('owner'), targetIdDel)) retained[rr].set('owner', actorDeleteRecord.id);
            var sharedWith = _removeId(retained[rr].get('shared_with'), targetIdDel);
            if (sharedWith !== retained[rr].get('shared_with')) retained[rr].set('shared_with', sharedWith || []);
          }
          if (retainName === 'calendar_events' && _sameId(retained[rr].get('owner'), targetIdDel)) retained[rr].set('owner', actorDeleteRecord.id);
          $app.save(retained[rr]);
          counts.transferred[retainName]++;
        }
      }

      var referenceClears = [
        ['tasks', 'assigned_to'], ['tasks', 'completed_by'],
        ['items', 'assigned_to'],
        ['notes', 'assigned_to'],
        ['rewards', 'earned_by'], ['rewards', 'awarded_by'],
        ['goals', 'target_user'],
        ['invite_codes', 'used_by'],
        ['labels', 'shared_with']
      ];
      for (var ci = 0; ci < referenceClears.length; ci++) {
        var collName = referenceClears[ci][0];
        var fieldName = referenceClears[ci][1];
        var refs = _recordsByReference(collName, fieldName, targetIdDel);
        counts.cleared[collName + '.' + fieldName] = refs.length;
        for (var ri = 0; ri < refs.length; ri++) {
          var current = refs[ri].get(fieldName);
          var nextValue = _removeId(current, targetIdDel);
          refs[ri].set(fieldName, nextValue || (Array.isArray(current) ? [] : ''));
          $app.save(refs[ri]);
        }
      }

      for (var pc = 0; pc < personalCollections.length; pc++) {
        var personalName = personalCollections[pc];
        counts.cascaded_personal[personalName] = _recordsByUser(personalName, targetIdDel).length;
      }

      $app.delete(targetDel);
      return c.json(200, { success: true, user_id: targetIdDel, deleted: true, counts: counts });
    }


    return c.json(400, { error: 'Unknown action: ' + action });
  } catch(e) { return require(__hooks + '/lib/errors.js').respondError(c, e, 500); }
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

    var fid = String(auth.get('family_id') || '');
    var tokenFilter = fid ? 'user.family_id = {:familyId}' : 'user = {:userId}';
    var allTokens = $app.findRecordsByFilter('api_tokens', tokenFilter, '', 10000, 0, fid ? { familyId: fid } : { userId: auth.id });
    var pending = 0, approved = 0;
    for (var ti = 0; ti < allTokens.length; ti++) {
      var rawEnabled = allTokens[ti].get('enabled');
      var isEnabled = rawEnabled !== false && rawEnabled !== 0 && rawEnabled !== 'false';
      if (isEnabled) approved++; else pending++;
    }
    return c.json(200, { pending: pending, approved: approved });
  } catch(e) { return require(__hooks + '/lib/errors.js').respondError(c, e, 500); }
});

// GET /api/agent/pending — returns tokens where enabled=false
routerAdd('GET', '/api/agent/pending', (c) => {
  try {
    var info = c.requestInfo();
    var auth = info && info.auth ? info.auth : null;
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    if (String(auth.get('role') || '') !== 'admin' && String(auth.get('role') || '') !== 'owner') return c.json(403, { error: 'Admin only' });

    var fid = String(auth.get('family_id') || '');
    var tokenFilter = fid ? 'user.family_id = {:familyId} && enabled = false' : 'user = {:userId} && enabled = false';
    var tokens = $app.findRecordsByFilter('api_tokens', tokenFilter, '', 10000, 0, fid ? { familyId: fid } : { userId: auth.id });
    var agents = [];
    for (var ti = 0; ti < tokens.length; ti++) {
      var t = tokens[ti];
      agents.push({
        id: t.id,
        name: String(t.get('name') || 'Agent'),
        email: '',
        status: 'pending',
        created: t.get('created') || '',
      });
    }
    return c.json(200, { agents: agents });
  } catch(e) { return require(__hooks + '/lib/errors.js').respondError(c, e, 500); }
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
    var invites = $app.findRecordsByFilter('invite_codes', 'token_id = {:tokenId}', '', 1, 0, { tokenId: tokenId });
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
  } catch(e) { return require(__hooks + '/lib/errors.js').respondError(c, e, 500); }
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
    var invites = $app.findRecordsByFilter('invite_codes', 'token_id = {:tokenId}', '', 1, 0, { tokenId: tokenId });
    if (invites.length > 0) {
      $app.delete(invites[0]);
    }

    $app.delete(token);
    return c.json(200, { deleted: true });
  } catch(e) { return require(__hooks + '/lib/errors.js').respondError(c, e, 500); }
});

// GET /api/agent/list — returns all tokens with status
routerAdd('GET', '/api/agent/list', (c) => {
  try {
    var info = c.requestInfo();
    var auth = info && info.auth ? info.auth : null;
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    if (String(auth.get('role') || '') !== 'admin' && String(auth.get('role') || '') !== 'owner') return c.json(403, { error: 'Admin only' });

    var fid = String(auth.get('family_id') || '');
    var tokenFilter = fid ? 'user.family_id = {:familyId}' : 'user = {:userId}';
    var tokens = $app.findRecordsByFilter('api_tokens', tokenFilter, '', 10000, 0, fid ? { familyId: fid } : { userId: auth.id });
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
        created: t.get('created') || '',
        updated: t.get('updated') || '',
      });
    }
    return c.json(200, { agents: agents });
  } catch(e) { return require(__hooks + '/lib/errors.js').respondError(c, e, 500); }
});

// DELETE /api/agent/:id — revoke token
routerAdd('DELETE', '/api/agent/{id}', (c) => {
  try {
    var info = c.requestInfo();
    var auth = info && info.auth ? info.auth : null;
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    if (String(auth.get('role') || '') !== 'admin' && String(auth.get('role') || '') !== 'owner') return c.json(403, { error: 'Admin only' });

    var tokenId = c.request.pathValue('id');
    if (!tokenId) return c.json(400, { error: 'id required' });

    var token = $app.findRecordById('api_tokens', tokenId);
    if (!token) return c.json(404, { error: 'Token not found' });
    var tokenUser = null; try { tokenUser = $app.findRecordById('users', String(token.get('user') || '')); } catch(e) {}
    if (!tokenUser || String(tokenUser.get('family_id') || '') !== String(auth.get('family_id') || '')) return c.json(403, { error: 'Token is outside your family.' });
    $app.delete(token);
    return c.json(200, { deleted: true });
  } catch(e) { return require(__hooks + '/lib/errors.js').respondError(c, e, 500); }
});
