// Derived from legacy pb_hooks/routes/agents.js (removed in GH#31).
// Agent API Access: API key management, agent-authenticated CRUD, audit logging
// API-002

// Shared agent/token helpers live in pb_hooks/lib/auth.js and are loaded inside route callbacks.

// ─── API Key Management (admin-only routes) ────────────────────────────────

// Create a new API key: POST /api/agent/keys
routerAdd('POST', '/api/agent/keys', function(c) {
  var authLib = require(__hooks + '/lib/auth.js');
  var authFromApiKey = authLib.authFromAgentKey;
  var generateApiKey = authLib.generateAgentKey;
  var getKeyPrefix = authLib.getKeyPrefix;
  var hasScope = authLib.hasAgentScope;
  var gv = authLib.gv;
  var getAgentUserFamily = authLib.getAgentUserFamily;
  var auditLog = authLib.auditLog;
  var normalizeLabelIds = authLib.normalizeLabelIds;
  var setCanonicalTaskLabels = authLib.setCanonicalTaskLabels;
  var canAccessTaskForUser = authLib.canAccessTaskForUser;

try {
    var info = c.requestInfo();
    var auth = (info && info.auth) || c.get('authRecord') || null;
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    if (!authLib.isAdminLike(auth)) return c.json(403, { error: 'Admin only' });

    var d = info.data || info.body || {};
    var name = String(gv(d, 'name', '')).trim();
    if (!name) return c.json(400, { error: 'name required' });

    var scopesRaw = gv(d, 'scopes', ['entries:read', 'entries:write']);
    var scopes = Array.isArray(scopesRaw) ? scopesRaw : [];
    var validScopes = ['entries:read', 'entries:write', 'users:read', 'users:admin', '*'];
    for (var si = 0; si < scopes.length; si++) {
      if (validScopes.indexOf(scopes[si]) === -1) {
        return c.json(400, { error: 'Invalid scope: ' + scopes[si] });
      }
    }

    var expiresAt = gv(d, 'expires_at', '');

    var rawKey = generateApiKey();
    var prefix = getKeyPrefix(rawKey);
    var keyHash = $security.sha256(rawKey);

    var rec = new Record($app.findCollectionByNameOrId('agent_keys'));
    rec.set('name', name);
    rec.set('key_hash', keyHash);
    rec.set('key_prefix', prefix);
    rec.set('permissions', scopes);
    rec.set('scopes', scopes);
    rec.set('active', true);
    rec.set('user', auth.id);
    if (expiresAt) rec.set('expires_at', expiresAt);
    $app.save(rec);

    // Audit log
    auditLog(rec, 'key_generate', 'agent_key', rec.id, { name: name, scopes: scopes }, c);

    return c.json(201, {
      id: rec.id,
      name: name,
      key: rawKey, // Only returned on creation
      key_prefix: prefix,
      scopes: scopes,
      active: true,
      expires_at: expiresAt || null,
    });
  } catch (e) {
    return require(__hooks + '/lib/errors.js').respondError(c, e, 500);
  }
});

// List API keys: GET /api/agent/keys
routerAdd('GET', '/api/agent/keys', function(c) {
  var authLib = require(__hooks + '/lib/auth.js');
  var dates = require(__hooks + '/lib/dates.js');
  var authFromApiKey = authLib.authFromAgentKey;
  var generateApiKey = authLib.generateAgentKey;
  var getKeyPrefix = authLib.getKeyPrefix;
  var hasScope = authLib.hasAgentScope;
  var gv = authLib.gv;
  var getAgentUserFamily = authLib.getAgentUserFamily;
  var auditLog = authLib.auditLog;
  var normalizeLabelIds = authLib.normalizeLabelIds;
  var setCanonicalTaskLabels = authLib.setCanonicalTaskLabels;
  var canAccessTaskForUser = authLib.canAccessTaskForUser;

try {
    var info = c.requestInfo();
    var auth = (info && info.auth) || c.get('authRecord') || null;
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    if (!authLib.isAdminLike(auth)) return c.json(403, { error: 'Admin only' });

    // Family-scoped, not creator-scoped (GH#22): after a single-admin demotion
    // the new admin must still see/manage keys minted by the former admin, as
    // long as both accounts share the same family. Falls back to self-only
    // when the admin has no family_id (matches /api/agent/dispatch's pattern).
    var familyId = String(auth.get('family_id') || '');
    var keys = familyId
      ? $app.findRecordsByFilter(
          'agent_keys',
          'user.family_id = {:familyId}',
          '',
          10000,
          0,
          { familyId: familyId }
        )
      : $app.findRecordsByFilter(
          'agent_keys',
          'user = {:userId}',
          '',
          10000,
          0,
          { userId: auth.id }
        );

    var result = [];
    for (var i = 0; i < keys.length; i++) {
      var r = keys[i];
      result.push({
        id: r.id,
        name: r.get('name'),
        key_prefix: r.get('key_prefix'),
        scopes: r.get('permissions') || r.get('scopes') || [],
        active: !!r.get('active'),
        last_used_at: dates.dateOrNull(r.get('last_used_at')),
        expires_at: dates.dateOrNull(r.get('expires_at')),
        created: r.created,
      });
    }

    return c.json(200, result);
  } catch (e) {
    return require(__hooks + '/lib/errors.js').respondError(c, e, 500);
  }
});

// Revoke an API key: POST /api/agent/keys/{id}/revoke
routerAdd('POST', '/api/agent/keys/{id}/revoke', function(c) {
  var authLib = require(__hooks + '/lib/auth.js');
  var authFromApiKey = authLib.authFromAgentKey;
  var generateApiKey = authLib.generateAgentKey;
  var getKeyPrefix = authLib.getKeyPrefix;
  var hasScope = authLib.hasAgentScope;
  var gv = authLib.gv;
  var getAgentUserFamily = authLib.getAgentUserFamily;
  var auditLog = authLib.auditLog;
  var normalizeLabelIds = authLib.normalizeLabelIds;
  var setCanonicalTaskLabels = authLib.setCanonicalTaskLabels;
  var canAccessTaskForUser = authLib.canAccessTaskForUser;

try {
    var info = c.requestInfo();
    var auth = (info && info.auth) || c.get('authRecord') || null;
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    if (!authLib.isAdminLike(auth)) return c.json(403, { error: 'Admin only' });

    var id = c.request.pathValue('id');
    if (!id) return c.json(400, { error: 'id required' });

    var rec = $app.findRecordById('agent_keys', id);
    if (!rec) return c.json(404, { error: 'Key not found' });

    // Family-scoped ownership check (GH#22): a key stays revocable by any
    // current family admin, not just the specific account that minted it —
    // otherwise a demoted admin's keys become permanently un-revocable.
    var keyOwnerId = String(rec.get('user') || '');
    var authFamilyId = String(auth.get('family_id') || '');
    var sameOwner = keyOwnerId === auth.id;
    var sameFamily = false;
    if (!sameOwner && authFamilyId && keyOwnerId) {
      try {
        var keyOwnerUser = $app.findRecordById('users', keyOwnerId);
        sameFamily = keyOwnerUser && String(keyOwnerUser.get('family_id') || '') === authFamilyId;
      } catch (_eo) { sameFamily = false; }
    }
    if (!sameOwner && !sameFamily) return c.json(403, { error: 'Not your key' });

    rec.set('active', false);
    $app.save(rec);

    auditLog(rec, 'key_revoke', 'agent_key', rec.id, { name: rec.get('name') }, c);

    return c.json(200, { id: rec.id, active: false });
  } catch (e) {
    return require(__hooks + '/lib/errors.js').respondError(c, e, 500);
  }
});

// ─── Agent Dispatch: POST /api/agent/dispatch ──────────────────────
// Authenticated by agent API key in Authorization header
// Body: { action, type, ...data }
// Actions: create, update, delete, complete, assign, set_labels, set_due_date, read

routerAdd('POST', '/api/agent/dispatch', function(c) {
  var authLib = require(__hooks + '/lib/auth.js');
  var taskStatus = require(__hooks + '/lib/task-status.js');
  var dates = require(__hooks + '/lib/dates.js');
  var authFromApiKey = authLib.authFromAgentKey;
  var generateApiKey = authLib.generateAgentKey;
  var getKeyPrefix = authLib.getKeyPrefix;
  var hasScope = authLib.hasAgentScope;
  var gv = authLib.gv;
  var getAgentUserFamily = authLib.getAgentUserFamily;
  var auditLog = authLib.auditLog;
  var normalizeLabelIds = authLib.normalizeLabelIds;
  var setCanonicalTaskLabels = authLib.setCanonicalTaskLabels;
  var canAccessTaskForUser = authLib.canAccessTaskForUser;

try {
    var agentKey = authFromApiKey(c);
    if (!agentKey) return c.json(401, { error: 'Invalid or missing API key' });
    if (!agentKey.get('active')) return c.json(403, { error: 'API key is revoked' });

    // Check expiry (GH#11: empty PB date fields are truthy DateTime objects,
    // so guard on hasDateValue, not bare truthiness).
    var rawExpires = agentKey.get('expires_at');
    if (dates.hasDateValue(rawExpires)) {
      var expMs = dates.toMs(rawExpires);
      if (expMs > 0 && expMs < Date.now()) {
        return c.json(403, { error: 'API key has expired' });
      }
    }

    var info = c.requestInfo();
    var d = info.data || info.body || {};
    var action = String(gv(d, 'action', '')).trim();
    if (!action) return c.json(400, { error: 'action required' });

    // Resolve which user/family this agent acts for
    var ownerUser = getAgentUserFamily(agentKey);
    if (!ownerUser) return c.json(500, { error: 'Agent owner not found' });
    var ownerStatus = String(ownerUser.get('member_status') || 'active');
    if (ownerUser.get('active') === false || ownerUser.get('active') === 0 || ownerUser.get('active') === 'false' || ownerStatus === 'blocked') return c.json(403, { error: 'Agent owner account is blocked' });
    if (ownerStatus === 'pending_approval') return c.json(403, { error: 'Agent owner is pending approval' });
    var familyId = String(ownerUser.get('family_id') || '');
    var actingUserId = ownerUser.id;

    // Helper: build a bound family-scoped filter.
    function familyQuery() {
      return familyId
        ? { filter: 'user.family_id = {:familyId}', params: { familyId: familyId } }
        : { filter: 'user = {:actingUserId}', params: { actingUserId: actingUserId } };
    }

    function recordInFamily(rec, fid, uid) {
      var ownerId = String(rec.get('user') || '');
      if (!fid) return ownerId === uid;
      var owner = null; try { owner = $app.findRecordById('users', ownerId); } catch(e) {}
      return !!owner && String(owner.get('family_id') || '') === fid;
    }

    // ── Agent actions ─────────────────────────────────────────────────────

    if (action === 'read') {
      if (!hasScope(agentKey, 'entries:read')) {
        return c.json(403, { error: 'Missing scope: entries:read' });
      }

      var type = String(gv(d, 'type', '')).trim();
      var id = String(gv(d, 'id', '')).trim();
      var collectionName = type === 'grocery' ? 'items' : 'tasks';

      if (id) {
        var rec = $app.findRecordById(collectionName, id);
        if (!rec) return c.json(404, { error: 'Entry not found' });

        // Ensure family-scoped access
        var recFamily = String(rec.get('user') || '');
        var recUser = $app.findRecordById('users', recFamily);
        var recFamilyId = recUser ? String(recUser.get('family_id') || '') : '';
        if (recFamilyId !== familyId && recFamily !== actingUserId) {
          // If no family, check individual match
          if (!familyId && recFamily !== actingUserId) {
            return c.json(403, { error: 'Access denied' });
          }
          // If has family, the family check above already passed or failed
          if (familyId && recFamilyId !== familyId) {
            return c.json(403, { error: 'Access denied' });
          }
        }
        if (collectionName === 'tasks' && !canAccessTaskForUser(rec, ownerUser)) {
          return c.json(403, { error: 'Access denied' });
        }

        auditLog(agentKey, 'read', type || collectionName, rec.id, {}, c);
        return c.json(200, {
          id: rec.id,
          type: type || 'task',
          title: String(rec.get('title') || ''),
          status: rec.get('completed') !== undefined ? (rec.get('completed') ? 'done' : 'todo') : String(rec.get('status') || 'todo'),
          description: String(rec.get('blocked_comment') || ''),
          assignee_id: String(rec.get('assigned_to') || ''),
          labels: rec.get('labels') || [],
          shop_id: String(rec.get('shop_id') || ''),
          quantity: rec.get('quantity') || null,
          created_by: String(rec.get('user') || ''),
          created_at: rec.created,
          updated_at: rec.updated,
        });
      }

      // List mode
      var q = info.query || {};
      var family = familyQuery();
      var f = family.filter;
      var queryParams = family.params;
      var itemQueryParams = familyId ? { familyId: familyId } : { actingUserId: actingUserId };
      var t = String(gv(q, 'type', '')).trim();
      var status = taskStatus.normalizeTaskStatus(gv(q, 'status', ''));
      if (status && !taskStatus.isTaskStatus(status)) return c.json(400, { error: 'Invalid status' });

      var results = [];

      if (!t || t === 'task') {
        var taskFilter = f;
        if (status) { taskFilter += ' && status = {:status}'; queryParams.status = status; }
        var tasks = $app.findRecordsByFilter('tasks', taskFilter, '-created', 10000, 0, queryParams);
        for (var ti = 0; ti < tasks.length; ti++) {
          var tr = tasks[ti];
          if (!canAccessTaskForUser(tr, ownerUser)) continue;
          results.push({
            id: tr.id, type: 'task',
            title: String(tr.get('title') || ''),
            status: String(tr.get('status') || 'todo'),
            description: String(tr.get('blocked_comment') || ''),
            assignee_id: String(tr.get('assigned_to') || ''),
            labels: tr.get('label') || tr.get('labels') || [],
            shop_id: '', quantity: null,
            due_date: dates.dateToString(tr.get('due_date')),
            created_by: String(tr.get('user') || ''),
            created_at: tr.created,
            updated_at: tr.updated,
          });
        }
      }

      if (!t || t === 'grocery') {
        var itemFilter = f;
        var items = $app.findRecordsByFilter('items', itemFilter, '-created', 10000, 0, itemQueryParams);
        for (var ii = 0; ii < items.length; ii++) {
          var ir = items[ii];
          results.push({
            id: ir.id, type: 'grocery',
            title: String(ir.get('title') || ''),
            status: ir.get('completed') ? 'done' : 'todo',
            description: '',
            assignee_id: String(ir.get('assigned_to') || ''),
            labels: ir.get('labels') || [],
            shop_id: String(ir.get('shop_id') || ''),
            quantity: ir.get('quantity') || 1,
            due_date: '',
            created_by: String(ir.get('user') || ''),
            created_at: ir.created,
            updated_at: ir.updated,
          });
        }
      }

      auditLog(agentKey, 'read', 'entries', '', { count: results.length }, c);
      return c.json(200, results);
    }

    // ── Write actions (require entries:write scope) ────────────────────────

    // All remaining actions need entries:write
    if (!hasScope(agentKey, 'entries:write')) {
      return c.json(403, { error: 'Missing scope: entries:write' });
    }

    if (action === 'create') {
      var type = String(gv(d, 'type', '')).trim();
      var title = String(gv(d, 'title', '')).trim();
      if (!type || (type !== 'task' && type !== 'grocery')) {
        return c.json(400, { error: 'type must be task or grocery' });
      }
      if (!title) return c.json(400, { error: 'title required' });

      if (type === 'task') {
        var rec = new Record($app.findCollectionByNameOrId('tasks'));
        rec.set('user', actingUserId);
        rec.set('title', title);
        var st = taskStatus.normalizeTaskStatus(gv(d, 'status', 'todo')) || 'todo';
        if (!taskStatus.isTaskStatus(st)) return c.json(400, { error: 'Invalid status' });
        rec.set('status', st);
        rec.set('blocked_comment', String(gv(d, 'description', '') || ''));
        if (!authLib.isValidAssigneeForUser(gv(d, 'assignee_id', ''), ownerUser)) return c.json(400, { error: 'Invalid assignee' });
        rec.set('assigned_to', gv(d, 'assignee_id', ''));
        var createLabels = authLib.validateLabelIdsForUser(gv(d, 'labels', []), ownerUser);
        if (!createLabels.ok) return c.json(createLabels.status, { error: createLabels.error });
        setCanonicalTaskLabels(rec, createLabels.ids);
        rec.set('due_date', gv(d, 'due_date', ''));
        rec.set('is_private', false);
        rec.set('completed_at', st === 'done' ? new Date().toISOString() : null);
        rec.set('flag', false);
        $app.save(rec);

        auditLog(agentKey, 'create', 'task', rec.id, { title: title }, c);
        return c.json(201, {
          id: rec.id, type: 'task',
          title: rec.get('title') || '',
          status: rec.get('status') || 'todo',
          description: rec.get('blocked_comment') || '',
          assignee_id: rec.get('assigned_to') || '',
          labels: rec.get('labels') || [],
          due_date: dates.dateToString(rec.get('due_date')),
          created_at: rec.created,
        });
      }

      // Grocery
      var itemColl = $app.findCollectionByNameOrId('items');
      var itemRec = new Record(itemColl);
      itemRec.set('user', actingUserId);
      itemRec.set('title', title);
      itemRec.set('completed', String(gv(d, 'status', 'todo')) === 'done');
      if (!authLib.isValidAssigneeForUser(gv(d, 'assignee_id', ''), ownerUser)) return c.json(400, { error: 'Invalid assignee' });
      itemRec.set('assigned_to', gv(d, 'assignee_id', ''));
      itemRec.set('labels', gv(d, 'labels', []));
      itemRec.set('shop_id', gv(d, 'shop_id', ''));
      itemRec.set('quantity', gv(d, 'quantity', 1));
      itemRec.set('is_private', false);
      $app.save(itemRec);

      auditLog(agentKey, 'create', 'grocery', itemRec.id, { title: title }, c);
      return c.json(201, {
        id: itemRec.id, type: 'grocery',
        title: itemRec.get('title') || '',
        status: itemRec.get('completed') ? 'done' : 'todo',
        assignee_id: itemRec.get('assigned_to') || '',
        labels: itemRec.get('labels') || [],
        shop_id: itemRec.get('shop_id') || '',
        quantity: itemRec.get('quantity') || 1,
        created_at: itemRec.created,
      });
    }

    if (action === 'update') {
      var id = String(gv(d, 'id', '')).trim();
      var type = String(gv(d, 'type', '')).trim();
      if (!id) return c.json(400, { error: 'id required' });
      if (!type || (type !== 'task' && type !== 'grocery')) {
        return c.json(400, { error: 'type must be task or grocery' });
      }

      var collName = type === 'task' ? 'tasks' : 'items';
      var rec = $app.findRecordById(collName, id);
      if (!rec) return c.json(404, { error: 'Entry not found' });
      if (!recordInFamily(rec, familyId, actingUserId)) return c.json(403, { error: 'Access denied' });
      if (type === 'task' && !canAccessTaskForUser(rec, ownerUser)) return c.json(403, { error: 'Access denied' });

      if (Object.prototype.hasOwnProperty.call(d, 'title')) rec.set('title', gv(d, 'title', ''));
      if (Object.prototype.hasOwnProperty.call(d, 'assignee_id')) {
        if (!authLib.isValidAssigneeForUser(gv(d, 'assignee_id', ''), ownerUser)) return c.json(400, { error: 'Invalid assignee' });
        rec.set('assigned_to', gv(d, 'assignee_id', ''));
      }
      if (Object.prototype.hasOwnProperty.call(d, 'labels')) {
        if (type === 'task') {
          var updateLabels = authLib.validateLabelIdsForUser(gv(d, 'labels', []), ownerUser);
          if (!updateLabels.ok) return c.json(updateLabels.status, { error: updateLabels.error });
          setCanonicalTaskLabels(rec, updateLabels.ids);
        }
        else rec.set('labels', gv(d, 'labels', []));
      }
      if (Object.prototype.hasOwnProperty.call(d, 'due_date')) rec.set('due_date', gv(d, 'due_date', ''));

      if (type === 'task') {
        if (Object.prototype.hasOwnProperty.call(d, 'description')) rec.set('blocked_comment', gv(d, 'description', ''));
        if (Object.prototype.hasOwnProperty.call(d, 'status')) {
          var sr = taskStatus.normalizeTaskStatus(gv(d, 'status', 'todo'));
          if (!taskStatus.isTaskStatus(sr)) return c.json(400, { error: 'Invalid status' });
          rec.set('status', sr);
          rec.set('completed_at', sr === 'done' ? new Date().toISOString() : null);
        }
      } else {
        if (Object.prototype.hasOwnProperty.call(d, 'status')) rec.set('completed', String(gv(d, 'status', 'todo')) === 'done');
        if (Object.prototype.hasOwnProperty.call(d, 'shop_id')) rec.set('shop_id', gv(d, 'shop_id', ''));
        if (Object.prototype.hasOwnProperty.call(d, 'quantity')) rec.set('quantity', gv(d, 'quantity', 1));
      }

      $app.save(rec);
      auditLog(agentKey, 'update', type, rec.id, { title: rec.get('title') }, c);
      return c.json(200, { id: rec.id, updated: true });
    }

    if (action === 'delete') {
      var id = String(gv(d, 'id', '')).trim();
      var type = String(gv(d, 'type', '')).trim();
      if (!id) return c.json(400, { error: 'id required' });
      if (!type || (type !== 'task' && type !== 'grocery')) {
        return c.json(400, { error: 'type must be task or grocery' });
      }

      var collName = type === 'task' ? 'tasks' : 'items';
      var rec = $app.findRecordById(collName, id);
      if (!rec) return c.json(404, { error: 'Entry not found' });
      if (!recordInFamily(rec, familyId, actingUserId)) return c.json(403, { error: 'Access denied' });
      if (type === 'task' && !canAccessTaskForUser(rec, ownerUser)) return c.json(403, { error: 'Access denied' });

      var title = String(rec.get('title') || '');
      $app.delete(rec);
      auditLog(agentKey, 'delete', type, id, { title: title }, c);
      return c.json(200, { deleted: true });
    }

    if (action === 'complete') {
      var id = String(gv(d, 'id', '')).trim();
      var type = String(gv(d, 'type', '')).trim();
      var complete = gv(d, 'complete', 'true') !== 'false';
      if (!id) return c.json(400, { error: 'id required' });
      if (!type || (type !== 'task' && type !== 'grocery')) {
        return c.json(400, { error: 'type must be task or grocery' });
      }

      var collName = type === 'task' ? 'tasks' : 'items';
      var rec = $app.findRecordById(collName, id);
      if (!rec) return c.json(404, { error: 'Entry not found' });
      if (!recordInFamily(rec, familyId, actingUserId)) return c.json(403, { error: 'Access denied' });
      if (type === 'task' && !canAccessTaskForUser(rec, ownerUser)) return c.json(403, { error: 'Access denied' });

      if (type === 'task') {
        rec.set('status', complete ? 'done' : 'todo');
        rec.set('completed_at', complete ? new Date().toISOString() : null);
      } else {
        rec.set('completed', complete);
      }
      $app.save(rec);
      auditLog(agentKey, 'complete', type, rec.id, { completed: complete }, c);
      return c.json(200, { completed: complete });
    }

    if (action === 'assign') {
      var id = String(gv(d, 'id', '')).trim();
      var type = String(gv(d, 'type', '')).trim();
      if (!id) return c.json(400, { error: 'id required' });
      if (!type || (type !== 'task' && type !== 'grocery')) {
        return c.json(400, { error: 'type must be task or grocery' });
      }

      var collName = type === 'task' ? 'tasks' : 'items';
      var rec = $app.findRecordById(collName, id);
      if (!rec) return c.json(404, { error: 'Entry not found' });
      if (!recordInFamily(rec, familyId, actingUserId)) return c.json(403, { error: 'Access denied' });
      if (type === 'task' && !canAccessTaskForUser(rec, ownerUser)) return c.json(403, { error: 'Access denied' });

      if (!authLib.isValidAssigneeForUser(gv(d, 'assignee_id', ''), ownerUser)) return c.json(400, { error: 'Invalid assignee' });
      rec.set('assigned_to', String(gv(d, 'assignee_id', '')));
      $app.save(rec);
      auditLog(agentKey, 'assign', type, rec.id, { assignee_id: gv(d, 'assignee_id', '') }, c);
      return c.json(200, { assigned: true });
    }

    if (action === 'set_labels') {
      var id = String(gv(d, 'id', '')).trim();
      var type = String(gv(d, 'type', '')).trim();
      if (!id) return c.json(400, { error: 'id required' });
      if (!type || (type !== 'task' && type !== 'grocery')) {
        return c.json(400, { error: 'type must be task or grocery' });
      }

      var collName = type === 'task' ? 'tasks' : 'items';
      var rec = $app.findRecordById(collName, id);
      if (!rec) return c.json(404, { error: 'Entry not found' });
      if (!recordInFamily(rec, familyId, actingUserId)) return c.json(403, { error: 'Access denied' });
      if (type === 'task' && !canAccessTaskForUser(rec, ownerUser)) return c.json(403, { error: 'Access denied' });

      var newLabels = gv(d, 'labels', []);
      if (type === 'task') {
        var setLabels = authLib.validateLabelIdsForUser(newLabels, ownerUser);
        if (!setLabels.ok) return c.json(setLabels.status, { error: setLabels.error });
        setCanonicalTaskLabels(rec, setLabels.ids);
      } else rec.set('labels', Array.isArray(newLabels) ? newLabels : []);
      $app.save(rec);
      auditLog(agentKey, 'set_labels', type, rec.id, { labels: rec.get('labels') }, c);
      return c.json(200, { labels: rec.get('labels') || [] });
    }

    if (action === 'set_due_date') {
      var id = String(gv(d, 'id', '')).trim();
      if (!id) return c.json(400, { error: 'id required' });

      var rec = $app.findRecordById('tasks', id);
      if (!rec) return c.json(404, { error: 'Task not found' });
      if (!recordInFamily(rec, familyId, actingUserId)) return c.json(403, { error: 'Access denied' });
      if (!canAccessTaskForUser(rec, ownerUser)) return c.json(403, { error: 'Access denied' });

      rec.set('due_date', String(gv(d, 'due_date', '') || ''));
      $app.save(rec);
      auditLog(agentKey, 'set_due_date', 'task', rec.id, { due_date: rec.get('due_date') }, c);
      return c.json(200, { due_date: dates.dateToString(rec.get('due_date')) });
    }

    return c.json(400, { error: 'Unknown action: ' + action + '. Valid actions: create, read, update, delete, complete, assign, set_labels, set_due_date' });
  } catch (e) {
    return require(__hooks + '/lib/errors.js').respondError(c, e, 500);
  }
});

// ─── Agent: GET list (lightweight alternative to POST read) ─────────────────
routerAdd('GET', '/api/agent/dispatch', function(c) {
  var authLib = require(__hooks + '/lib/auth.js');
  var taskStatus = require(__hooks + '/lib/task-status.js');
  var dates = require(__hooks + '/lib/dates.js');
  var authFromApiKey = authLib.authFromAgentKey;
  var generateApiKey = authLib.generateAgentKey;
  var getKeyPrefix = authLib.getKeyPrefix;
  var hasScope = authLib.hasAgentScope;
  var gv = authLib.gv;
  var getAgentUserFamily = authLib.getAgentUserFamily;
  var auditLog = authLib.auditLog;
  var normalizeLabelIds = authLib.normalizeLabelIds;
  var setCanonicalTaskLabels = authLib.setCanonicalTaskLabels;
  var canAccessTaskForUser = authLib.canAccessTaskForUser;

try {
    var agentKey = authFromApiKey(c);
    if (!agentKey) return c.json(401, { error: 'Invalid or missing API key' });
    if (!agentKey.get('active')) return c.json(403, { error: 'API key is revoked' });

    // Check expiry
    var rawExpires = agentKey.get('expires_at');
    if (rawExpires) {
      var expMs = new Date(String(rawExpires).replace(' ', 'T')).getTime();
      if (expMs > 0 && expMs < Date.now()) {
        return c.json(403, { error: 'API key has expired' });
      }
    }

    if (!hasScope(agentKey, 'entries:read')) {
      return c.json(403, { error: 'Missing scope: entries:read' });
    }

    var ownerUser = getAgentUserFamily(agentKey);
    if (!ownerUser) return c.json(500, { error: 'Agent owner not found' });
    var ownerStatus = String(ownerUser.get('member_status') || 'active');
    if (ownerUser.get('active') === false || ownerUser.get('active') === 0 || ownerUser.get('active') === 'false' || ownerStatus === 'blocked') return c.json(403, { error: 'Agent owner account is blocked' });
    if (ownerStatus === 'pending_approval') return c.json(403, { error: 'Agent owner is pending approval' });
    var familyId = String(ownerUser.get('family_id') || '');
    var actingUserId = ownerUser.id;

    var f = familyId ? 'user.family_id = {:familyId}' : 'user = {:actingUserId}';
    var queryParams = familyId ? { familyId: familyId } : { actingUserId: actingUserId };
    var itemQueryParams = familyId ? { familyId: familyId } : { actingUserId: actingUserId };
    var info = c.requestInfo();
    var q = info.query || {};
    var t = String(gv(q, 'type', '')).trim();
    var status = taskStatus.normalizeTaskStatus(gv(q, 'status', ''));
    if (status && !taskStatus.isTaskStatus(status)) return c.json(400, { error: 'Invalid status' });
    var limit = parseInt(gv(q, 'limit', '100'), 10);
    if (limit < 1) limit = 100;

    var results = [];

    if (!t || t === 'task') {
      var taskFilter = f;
      if (status) { taskFilter += ' && status = {:status}'; queryParams.status = status; }
      var tasks = $app.findRecordsByFilter('tasks', taskFilter, '-created', limit, 0, queryParams);
      for (var ti = 0; ti < tasks.length; ti++) {
        var tr = tasks[ti];
        if (!canAccessTaskForUser(tr, ownerUser)) continue;
        results.push({
          id: tr.id, type: 'task',
          title: String(tr.get('title') || ''),
          status: String(tr.get('status') || 'todo'),
          assignee_id: String(tr.get('assigned_to') || ''),
          labels: tr.get('label') || tr.get('labels') || [],
          due_date: dates.dateToString(tr.get('due_date')),
          created_by: String(tr.get('user') || ''),
          created_at: tr.created,
        });
      }
    }

    if (!t || t === 'grocery') {
      var items = $app.findRecordsByFilter('items', f, '-created', limit, 0, itemQueryParams);
      for (var ii = 0; ii < items.length; ii++) {
        var ir = items[ii];
        results.push({
          id: ir.id, type: 'grocery',
          title: String(ir.get('title') || ''),
          status: ir.get('completed') ? 'done' : 'todo',
          assignee_id: String(ir.get('assigned_to') || ''),
          labels: ir.get('labels') || [],
          shop_id: String(ir.get('shop_id') || ''),
          quantity: ir.get('quantity') || 1,
          created_by: String(ir.get('user') || ''),
          created_at: ir.created,
        });
      }
    }

    return c.json(200, results);
  } catch (e) {
    return require(__hooks + '/lib/errors.js').respondError(c, e, 500);
  }
});

// ─── Auth test endpoint: GET /api/agent/auth-test ──────────────────
routerAdd('GET', '/api/agent/auth-test', function(c) {
  var authLib = require(__hooks + '/lib/auth.js');
  var authFromApiKey = authLib.authFromAgentKey;
  var generateApiKey = authLib.generateAgentKey;
  var getKeyPrefix = authLib.getKeyPrefix;
  var hasScope = authLib.hasAgentScope;
  var gv = authLib.gv;
  var getAgentUserFamily = authLib.getAgentUserFamily;
  var auditLog = authLib.auditLog;
  var normalizeLabelIds = authLib.normalizeLabelIds;
  var setCanonicalTaskLabels = authLib.setCanonicalTaskLabels;
  var canAccessTaskForUser = authLib.canAccessTaskForUser;

try {
    var agentKey = authFromApiKey(c);
    if (!agentKey) return c.json(401, { error: 'Invalid or missing API key' });

    return c.json(200, {
      authenticated: true,
      key_id: agentKey.id,
      name: agentKey.get('name'),
      scopes: agentKey.get('permissions') || agentKey.get('scopes') || [],
      active: !!agentKey.get('active'),
    });
  } catch (e) {
    return require(__hooks + '/lib/errors.js').respondError(c, e, 500);
  }
});

// ─── Agent audit log: GET /api/agent/audit-log ────────────────────
routerAdd('GET', '/api/agent/audit-log', function(c) {
  var authLib = require(__hooks + '/lib/auth.js');
  var authFromApiKey = authLib.authFromAgentKey;
  var generateApiKey = authLib.generateAgentKey;
  var getKeyPrefix = authLib.getKeyPrefix;
  var hasScope = authLib.hasAgentScope;
  var gv = authLib.gv;
  var getAgentUserFamily = authLib.getAgentUserFamily;
  var auditLog = authLib.auditLog;
  var normalizeLabelIds = authLib.normalizeLabelIds;
  var setCanonicalTaskLabels = authLib.setCanonicalTaskLabels;
  var canAccessTaskForUser = authLib.canAccessTaskForUser;

try {
    var info = c.requestInfo();
    var auth = (info && info.auth) || c.get('authRecord') || null;
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    if (!authLib.isAdminLike(auth)) return c.json(403, { error: 'Admin only' });

    var q = info.query || {};
    var limit = parseInt(gv(q, 'limit', '100'), 10);
    if (limit < 1) limit = 100;
    var actionFilter = String(gv(q, 'action', '')).trim();
    var keyIdFilter = String(gv(q, 'key_id', '')).trim();

    var filter = 'user = {:userId}';
    var queryParams = { userId: auth.id };
    if (actionFilter) { filter += ' && action = {:action}'; queryParams.action = actionFilter; }
    if (keyIdFilter) { filter += ' && agent_key_id = {:keyId}'; queryParams.keyId = keyIdFilter; }

    var logs = $app.findRecordsByFilter('agent_audit_log', filter, '-created', limit, 0, queryParams);
    var result = [];
    for (var i = 0; i < logs.length; i++) {
      var l = logs[i];
      result.push({
        id: l.id,
        agent_key_id: String(l.get('agent_key_id') || ''),
        agent_name: String(l.get('agent_name') || ''),
        action: String(l.get('action') || ''),
        entity_type: String(l.get('entity_type') || ''),
        entity_id: String(l.get('entity_id') || ''),
        details: l.get('details') || {},
        ip_address: String(l.get('ip_address') || ''),
        created: l.created,
      });
    }

    return c.json(200, result);
  } catch (e) {
    return require(__hooks + '/lib/errors.js').respondError(c, e, 500);
  }
});
