// pb_hooks/routes/agent-tasks.js
// Agent Task & Reminder endpoints - API-005
// Agents can list tasks assigned to them, update task status, create/list reminders

// ─── Helpers (reused from agents.js pattern) ─────────────────────────────────

function authFromApiKey(c) {
  var authHeader = c.request().header.get('Authorization') || '';
  var parts = authHeader.split(' ');
  var token = '';
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    token = parts[1].trim();
  }
  if (!token) return null;

  var prefix = token.substring(0, 12);
  var candidates = $app.dao().findRecordsByFilter(
    'agent_keys',
    'key_prefix = "' + prefix + '" && active = true',
    '-created',
    10,
    0
  );

  for (var i = 0; i < candidates.length; i++) {
    var storedHash = candidates[i].get('key_hash');
    if ($security.compareWithHash(storedHash, token)) {
      try {
        candidates[i].set('last_used_at', new Date().toISOString());
        $app.dao().saveRecord(candidates[i]);
      } catch (_eu) {}
      return candidates[i];
    }
  }
  return null;
}

function hasScope(agentKey, requiredScope) {
  var scopes = agentKey.get('scopes');
  if (!scopes || !Array.isArray(scopes)) return false;
  if (scopes.indexOf('*') !== -1) return true;
  if (scopes.indexOf(requiredScope) !== -1) return true;
  if (requiredScope === 'entries:read' && scopes.indexOf('entries:write') !== -1) return true;
  if (requiredScope === 'users:read' && scopes.indexOf('users:admin') !== -1) return true;
  return false;
}

function getAgentUserFamily(agentKey) {
  var userId = String(agentKey.get('user') || '');
  if (!userId) return null;
  try {
    return $app.dao().findRecordById('users', userId);
  } catch (_e) {
    return null;
  }
}

function gv(o, k, f) {
  if (f === undefined) f = '';
  if (!o) return f;
  if (Object.prototype.hasOwnProperty.call(o, k)) {
    var v = o[k];
    return (v === undefined || v === null) ? f : v;
  }
  return f;
}

// ─── Agent Auth Middleware ────────────────────────────────────────────────────

function requireAgentAuth(c) {
  var agentKey = authFromApiKey(c);
  if (!agentKey) return { error: 'Invalid or missing API key', status: 401 };
  if (!agentKey.get('active')) return { error: 'API key is revoked', status: 403 };

  var rawExpires = agentKey.get('expires_at');
  if (rawExpires) {
    var expMs = new Date(String(rawExpires)).getTime();
    if (expMs > 0 && expMs < Date.now()) {
      return { error: 'API key has expired', status: 403 };
    }
  }

  var ownerUser = getAgentUserFamily(agentKey);
  if (!ownerUser) return { error: 'Agent owner not found', status: 500 };

  return {
    agentKey: agentKey,
    ownerUser: ownerUser,
    familyId: String(ownerUser.get('family_id') || ''),
    actingUserId: ownerUser.id
  };
}

// ─── GET /api/todoless/agent/tasks ────────────────────────────────────────────
// List tasks assigned to the agent

routerAdd('GET', '/api/todoless/agent/tasks', function(c) {
  try {
    var auth = requireAgentAuth(c);
    if (auth.error) return c.json(auth.status, { error: auth.error });
    if (!hasScope(auth.agentKey, 'entries:read')) {
      return c.json(403, { error: 'Missing scope: entries:read' });
    }

    var info = c.requestInfo();
    var q = info.query || {};
    var status = String(gv(q, 'status', '')).trim();

    // Filter by assignee = agent's user id
    var filter = 'assigned_to = "' + auth.actingUserId + '"';
    if (status) {
      filter += ' && status = "' + status + '"';
    }

    var sort = $request.queryParam('sort') || '-created';
    var limit = parseInt(gv(q, 'limit', '100'), 10);
    if (limit < 1) limit = 100;

    var tasks = $app.dao().findRecordsByFilter('tasks', filter, sort, limit, 0);

    var result = [];
    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      result.push({
        id: t.id,
        title: String(t.get('title') || ''),
        status: String(t.get('status') || 'todo'),
        priority: t.get('priority') || '',
        horizon: t.get('horizon') || '',
        due_date: t.get('due_date') || '',
        blocked: !!t.get('blocked'),
        blocked_comment: String(t.get('blocked_comment') || ''),
        assignee_id: String(t.get('assigned_to') || ''),
        labels: t.get('labels') || [],
        created_by: String(t.get('user') || ''),
        created_at: t.created,
        updated_at: t.updated,
      });
    }

    return c.json(200, result);
  } catch (e) {
    return c.json(500, { error: String(e) });
  }
});

// ─── PATCH /api/todoless/agent/tasks/:id ──────────────────────────────────────
// Update task status (for agents) - complete, pause, etc.

routerAdd('PATCH', '/api/todoless/agent/tasks/:id', function(c) {
  try {
    var auth = requireAgentAuth(c);
    if (auth.error) return c.json(auth.status, { error: auth.error });
    if (!hasScope(auth.agentKey, 'entries:write')) {
      return c.json(403, { error: 'Missing scope: entries:write' });
    }

    var id = c.pathParam('id');
    if (!id) return c.json(400, { error: 'id required' });

    var record = $app.dao().findRecordById('tasks', id);
    if (!record) return c.json(404, { error: 'Task not found' });

    // Agent can only update tasks assigned to them
    var assignee = String(record.get('assigned_to') || '');
    if (assignee !== auth.actingUserId) {
      return c.json(403, { error: 'Not assigned to you' });
    }

    var info = c.requestInfo();
    var d = info.data || info.body || {};

    // Allowed fields an agent can update
    if (Object.prototype.hasOwnProperty.call(d, 'status')) {
      var newStatus = String(gv(d, 'status', '')).trim();
      var validStatuses = ['backlog', 'todo', 'in_progress', 'done', 'pause'];
      if (validStatuses.indexOf(newStatus) >= 0) {
        record.set('status', newStatus);
        // Set completed_at when marking done
        if (newStatus === 'done') {
          record.set('completed_at', new Date().toISOString());
        } else if (newStatus !== 'done') {
          record.set('completed_at', null);
        }
      }
    }

    if (Object.prototype.hasOwnProperty.call(d, 'blocked')) {
      record.set('blocked', !!d.blocked);
    }

    if (Object.prototype.hasOwnProperty.call(d, 'blocked_comment')) {
      record.set('blocked_comment', String(gv(d, 'blocked_comment', '')));
    }

    $app.dao().saveRecord(record);

    return c.json(200, {
      id: record.id,
      title: record.get('title') || '',
      status: record.get('status') || 'todo',
      updated: true
    });
  } catch (e) {
    return c.json(500, { error: String(e) });
  }
});

// ─── POST /api/todoless/agent/reminders ───────────────────────────────────────
// Create a reminder with title, due date, linked task

routerAdd('POST', '/api/todoless/agent/reminders', function(c) {
  try {
    var auth = requireAgentAuth(c);
    if (auth.error) return c.json(auth.status, { error: auth.error });
    if (!hasScope(auth.agentKey, 'entries:write')) {
      return c.json(403, { error: 'Missing scope: entries:write' });
    }

    var info = c.requestInfo();
    var d = info.data || info.body || {};

    var title = String(gv(d, 'title', '')).trim();
    if (!title) return c.json(400, { error: 'title required' });

    var reminderTime = String(gv(d, 'reminder_time', '')).trim();
    if (!reminderTime) return c.json(400, { error: 'reminder_time required' });

    // Validate linked task if provided
    var linkedTo = String(gv(d, 'linked_to', '')).trim();
    var linkedType = String(gv(d, 'linked_type', '')).trim() || 'task';

    if (linkedTo) {
      var task = $app.dao().findRecordById('tasks', linkedTo);
      if (!task) return c.json(404, { error: 'Linked task not found' });
    }

    var collection = $app.dao().findCollectionByNameOrId('reminders');
    var record = new Record(collection);

    record.set('user', auth.actingUserId);
    record.set('title', title);
    record.set('reminder_time', reminderTime);
    record.set('fired', false);
    record.set('dismissed', false);

    if (d.message) record.set('message', String(d.message));
    if (linkedType) record.set('linked_type', linkedType);
    if (linkedTo) record.set('linked_to', linkedTo);
    if (d.repeat_interval) record.set('repeat_interval', d.repeat_interval);

    $app.dao().saveRecord(record);

    return c.json(201, {
      id: record.id,
      title: record.get('title') || '',
      reminder_time: record.get('reminder_time') || '',
      linked_type: record.get('linked_type') || '',
      linked_to: record.get('linked_to') || '',
      fired: false,
      dismissed: false,
      created_at: record.created,
    });
  } catch (e) {
    return c.json(500, { error: String(e) });
  }
});

// ─── GET /api/todoless/agent/reminders ────────────────────────────────────────
// List reminders for agent (active, not dismissed)

routerAdd('GET', '/api/todoless/agent/reminders', function(c) {
  try {
    var auth = requireAgentAuth(c);
    if (auth.error) return c.json(auth.status, { error: auth.error });
    if (!hasScope(auth.agentKey, 'entries:read')) {
      return c.json(403, { error: 'Missing scope: entries:read' });
    }

    var info = c.requestInfo();
    var q = info.query || {};
    var includeFired = String(gv(q, 'include_fired', 'false')).trim() === 'true';

    // Filter by owner user
    var filter = 'user = "' + auth.actingUserId + '"';

    if (!includeFired) {
      filter += ' && fired = false && dismissed = false';
    }

    var sort = $request.queryParam('sort') || 'reminder_time';

    var reminders = $app.dao().findRecordsByFilter('reminders', filter, sort, 0, 0);

    var result = [];
    for (var i = 0; i < reminders.length; i++) {
      var r = reminders[i];
      result.push({
        id: r.id,
        title: String(r.get('title') || ''),
        message: String(r.get('message') || ''),
        reminder_time: r.get('reminder_time') || '',
        linked_type: r.get('linked_type') || '',
        linked_to: r.get('linked_to') || '',
        fired: !!r.get('fired'),
        dismissed: !!r.get('dismissed'),
        repeat_interval: r.get('repeat_interval') || '',
        created_at: r.created,
      });
    }

    return c.json(200, result);
  } catch (e) {
    return c.json(500, { error: String(e) });
  }
});