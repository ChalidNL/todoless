// pb_hooks/12_api_routes.pb.js
// Fast API-based task/grocery CRUD for agents and members.
// Uses Bearer token auth OR PB session auth.
// All created items link to the token owner's user record and family.

// PB 0.35 routes are self-contained; crypto helpers are called inline.

// ─── POST /api/tasks — Create task (optional subtasks) ──────────
routerAdd('POST', '/api/tasks', function(c) {
  try {
    // Step 1: Try Bearer token auth
    var authHeader = c.requestInfo().headers['authorization'];
    if (authHeader) {
      var parts = String(authHeader).split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer' && parts[1]) {
        var token = parts[1].trim();
        var hashed = $security.sha256(token);
        var tokens = $app.findRecordsByFilter('api_tokens', 'token_hash = {:hash}', '', 1, 0, { hash: hashed });
        if (tokens.length > 0) {
          var tokRec = tokens[0];
          var rawEnabled = tokRec.get('enabled');
          if (rawEnabled === false || rawEnabled === 0 || rawEnabled === 'false') {
            return c.json(401, { error: 'API token is disabled' });
          }
          var rawExp = tokRec.get('expires_at');
          if (rawExp) {
            var expMs = 0;
            if (typeof rawExp === 'string') expMs = new Date(String(rawExp).replace(' ', 'T')).getTime();
            else if (rawExp && typeof rawExp.getTime === 'function') expMs = rawExp.getTime();
            else if (rawExp) expMs = new Date(String(rawExp).replace(' ', 'T')).getTime();
            if (expMs > 0 && expMs < new Date().getTime()) {
              return c.json(401, { error: 'API token has expired' });
            }
          }
          var tokUserId = String(tokRec.get('user') || '');
          var user = null;
          try { user = $app.findRecordById('users', tokUserId); } catch(e) {}
          if (!user) return c.json(401, { error: 'Token owner not found' });
          c.set('authRecord', user);
          c.set('apiTokenInfo', {
            token_id: tokRec.id,
            token_name: String(tokRec.get('name') || ''),
            user_id: user.id,
            user_role: String(user.get('role') || 'user'),
            user_name: String(user.get('name') || user.get('email') || ''),
            family_id: String(user.get('family_id') || ''),
            permissions: (function(){var rp='';try{rp=String(tokRec.getString('permissions')||'')}catch(e){}if(!rp||rp==='[]')try{rp=String(tokRec.getString('scopes')||'')}catch(e){}var ps=[];if(rp)try{ps=JSON.parse(rp)}catch(e){}return ps;})()
          });
        }
      }
    }

    // Step 2: Resolve user from either token or session
    var tokInfo = c.get('apiTokenInfo');
    var info = c.requestInfo();
    var userId = null;
    var familyId = '';
    var isAgent = false;

    if (tokInfo) {
      userId = tokInfo.user_id;
      familyId = tokInfo.family_id;
      isAgent = true;
    } else {
      var auth = info && info.auth ? info.auth : null;
      if (!auth) return c.json(401, { error: 'Unauthorized — provide Bearer token or login' });
      userId = auth.id;
      familyId = String(auth.get('family_id') || '');
    }

    // Step 3: Parse body
    if (tokInfo) { var ps=tokInfo.permissions||[]; var ok=false; for(var pi=0;pi<ps.length;pi++){var pp=String(ps[pi]||''); if(pp==='*'||pp==='tasks:write'||pp==='tasks:*') ok=true;} if(!ok) return c.json(403, { error: 'Missing permission: tasks:write' }); }
    var body = info.body || {};
    var title = String(body.title || '').trim();
    if (!title) return c.json(400, { error: 'title is required' });

    // Step 4: Create parent task
    var coll = $app.findCollectionByNameOrId('tasks');
    var now = new Date().toISOString();
    var rec = new Record(coll);
    rec.set('title', title);
    rec.set('status', String(body.status || 'todo'));
    rec.set('user', userId);
    rec.set('blocked', body.blocked === true || body.blocked === 'true');
    if (body.description) rec.set('blocked_comment', String(body.description));
    if (body.assigned_to) rec.set('assigned_to', String(body.assigned_to));
    var labelIds = [];
    if (body.labels && Array.isArray(body.labels)) {
      for (var li = 0; li < body.labels.length; li++) {
        var candidate = String(body.labels[li] || '').trim();
        if (candidate && labelIds.indexOf(candidate) === -1) labelIds.push(candidate);
      }
    }
    for (var lvi = 0; lvi < labelIds.length; lvi++) {
      var label = null;
      try { label = $app.findRecordById('labels', labelIds[lvi]); } catch(e) {}
      if (!label) return c.json(400, { error: 'Invalid label' });
      var labelFamily = String(label.get('family') || '');
      if (familyId && labelFamily !== familyId) return c.json(403, { error: 'Label is outside your family' });
      var visibility = String(label.get('visibility') || (label.get('is_private') ? 'private' : 'family'));
      var owner = String(label.get('owner') || label.get('user') || '');
      var sharedWith = label.get('shared_with') || [];
      if (!Array.isArray(sharedWith)) sharedWith = sharedWith ? [String(sharedWith)] : [];
      if (labelIds.length > 1 && visibility !== 'family') return c.json(403, { error: 'Multiple labels must all be family-visible' });
      if (visibility === 'private' && owner !== userId) return c.json(403, { error: 'Private label is not accessible' });
      if (visibility === 'shared' && owner !== userId && sharedWith.indexOf(userId) === -1) return c.json(403, { error: 'Shared label is not accessible' });
    }
    rec.set('labels', labelIds);
    rec.set('label', labelIds);
    if (body.due_date) rec.set('due_date', String(body.due_date));
    if (body.priority) rec.set('priority', String(body.priority));
    if (body.horizon) rec.set('horizon', String(body.horizon));
    if (body.flag === true || body.flag === 'true') rec.set('flag', true);
    else if (body.flag === false || body.flag === 'false') rec.set('flag', false);
    if (body.archived === true || body.archived === 'true') rec.set('archived', true);
    $app.save(rec);

    // Step 5: Create subtasks if provided
    var subtaskIds = [];
    if (body.subtasks && Array.isArray(body.subtasks)) {
      for (var si = 0; si < body.subtasks.length; si++) {
        var st = body.subtasks[si];
        var stTitle = String(st.title || '').trim();
        if (!stTitle) continue;
        var childRec = new Record(coll);
        childRec.set('title', stTitle);
        childRec.set('status', 'todo');
        childRec.set('user', userId);
        childRec.set('blocked', false);
        childRec.set('linked_to', rec.id);
        childRec.set('linked_type', 'task');
        $app.save(childRec);
        subtaskIds.push(childRec.id);
      }
      if (subtaskIds.length > 0) {
        rec.set('subtask_ids', subtaskIds);
        $app.save(rec);
      }
    }

    // Step 6: Build response
    var response = {
      id: rec.id,
      title: String(rec.get('title') || ''),
      status: String(rec.get('status') || 'todo'),
      createdBy: userId,
      createdByType: isAgent ? 'agent' : 'user',
      workspaceId: familyId,
      createdAt: now,
      subtaskIds: subtaskIds,
      subtasks: body.subtasks ? body.subtasks.map(function(s, i) {
        return subtaskIds[i] ? {
          id: subtaskIds[i],
          title: String(s.title || ''),
          status: 'todo',
          createdBy: userId,
          createdByType: isAgent ? 'agent' : 'user'
        } : null;
      }).filter(function(x) { return x !== null; }) : [],
      visibleToMembers: true
    };
    if (body.description) response.description = body.description;
    if (body.labels) response.labels = body.labels;
    if (body.due_date) response.dueDate = body.due_date;
    if (body.priority) response.priority = body.priority;
    if (body.flag !== undefined) response.flag = body.flag;
    if (body.assigned_to) response.assigneeId = body.assigned_to;

    return c.json(201, response);
  } catch(e) {
    try { $app.logger().error('api route error: ' + String(e)); } catch(_e) {}
    return c.json(500, { error: 'Internal server error' });
  }
});

// ─── POST /api/tasks/{taskId}/subtasks — Create subtask ─────────
routerAdd('POST', '/api/tasks/{taskId}/subtasks', function(c) {
  try {
    // Bearer token auth
    var authHeader = c.requestInfo().headers['authorization'];
    if (authHeader) {
      var parts = String(authHeader).split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer' && parts[1]) {
        var token = parts[1].trim();
        var hashed = $security.sha256(token);
        var tokens = $app.findRecordsByFilter('api_tokens', 'token_hash = {:hash}', '', 1, 0, { hash: hashed });
        if (tokens.length > 0) {
          var tokRec = tokens[0];
          var rawEnabled = tokRec.get('enabled');
          if (rawEnabled === false || rawEnabled === 0 || rawEnabled === 'false') return c.json(401, { error: 'API token is disabled' });
          var rawExp = tokRec.get('expires_at');
          if (rawExp) {
            var expMs = 0;
            if (typeof rawExp === 'string') expMs = new Date(String(rawExp).replace(' ', 'T')).getTime();
            else if (rawExp && typeof rawExp.getTime === 'function') expMs = rawExp.getTime();
            else if (rawExp) expMs = new Date(String(rawExp).replace(' ', 'T')).getTime();
            if (expMs > 0 && expMs < new Date().getTime()) return c.json(401, { error: 'API token has expired' });
          }
          var tokUserId = String(tokRec.get('user') || '');
          var user = null;
          try { user = $app.findRecordById('users', tokUserId); } catch(e) {}
          if (!user) return c.json(401, { error: 'Token owner not found' });
          c.set('authRecord', user);
          c.set('apiTokenInfo', { token_id: tokRec.id, user_id: user.id, family_id: String(user.get('family_id') || ''), permissions: (function(){var rp='';try{rp=String(tokRec.getString('permissions')||'')}catch(e){}if(!rp||rp==='[]')try{rp=String(tokRec.getString('scopes')||'')}catch(e){}var ps=[];if(rp)try{ps=JSON.parse(rp)}catch(e){}return ps;})() });
        }
      }
    }

    var tokInfo = c.get('apiTokenInfo');
    var info = c.requestInfo();
    var userId = null;
    var familyId = '';
    var isAgent = false;

    if (tokInfo) {
      userId = tokInfo.user_id;
      familyId = tokInfo.family_id;
      isAgent = true;
    } else {
      var auth = info && info.auth ? info.auth : null;
      if (!auth) return c.json(401, { error: 'Unauthorized' });
      userId = auth.id;
      familyId = String(auth.get('family_id') || '');
    }

    var taskId = c.request.pathValue('taskId');
    if (!taskId) return c.json(400, { error: 'taskId is required' });
    if (tokInfo) { var ps=tokInfo.permissions||[]; var ok=false; for(var pi=0;pi<ps.length;pi++){var pp=String(ps[pi]||''); if(pp==='*'||pp==='tasks:write'||pp==='tasks:*') ok=true;} if(!ok) return c.json(403, { error: 'Missing permission: tasks:write' }); }

    var body = info.body || {};
    var title = String(body.title || '').trim();
    if (!title) return c.json(400, { error: 'title is required' });

    // Find parent task
    var parentTask = null;
    try { parentTask = $app.findRecordById('tasks', taskId); } catch(e) {}
    if (!parentTask) return c.json(404, { error: 'Task not found' });
    var parentOwner=String(parentTask.get('user')||''); if(parentOwner!==userId) return c.json(404,{error:'Task not found'});

    // Create subtask
    var coll = $app.findCollectionByNameOrId('tasks');
    var rec = new Record(coll);
    rec.set('title', title);
    rec.set('status', 'todo');
    rec.set('user', userId);
    rec.set('blocked', false);
    rec.set('linked_to', taskId);
    rec.set('linked_type', 'task');
    $app.save(rec);

    // Update parent's subtask_ids
    var existingIds = parentTask.get('subtask_ids');
    if (!Array.isArray(existingIds)) existingIds = [];
    existingIds.push(rec.id);
    parentTask.set('subtask_ids', existingIds);
    $app.save(parentTask);

    return c.json(201, {
      id: rec.id,
      title: String(rec.get('title') || ''),
      status: 'todo',
      parentTaskId: taskId,
      createdBy: userId,
      createdByType: isAgent ? 'agent' : 'user',
      workspaceId: familyId,
      visibleToMembers: true
    });
  } catch(e) {
    try { $app.logger().error('api route error: ' + String(e)); } catch(_e) {}
    return c.json(500, { error: 'Internal server error' });
  }
});

// ─── PATCH /api/tasks/{taskId} — Update task ────────────────────
routerAdd('PATCH', '/api/tasks/{taskId}', function(c) {
  try {
    var authHeader = c.requestInfo().headers['authorization'];
    if (authHeader) {
      var parts = String(authHeader).split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer' && parts[1]) {
        var token = parts[1].trim();
        var hashed = $security.sha256(token);
        var tokens = $app.findRecordsByFilter('api_tokens', 'token_hash = {:hash}', '', 1, 0, { hash: hashed });
        if (tokens.length > 0) {
          var tokRec = tokens[0];
          var rawEnabled = tokRec.get('enabled');
          if (rawEnabled === false || rawEnabled === 0 || rawEnabled === 'false') return c.json(401, { error: 'API token is disabled' });
          var rawExp = tokRec.get('expires_at');
          if (rawExp) {
            var expMs = 0;
            if (typeof rawExp === 'string') expMs = new Date(String(rawExp).replace(' ', 'T')).getTime();
            else if (rawExp && typeof rawExp.getTime === 'function') expMs = rawExp.getTime();
            else if (rawExp) expMs = new Date(String(rawExp).replace(' ', 'T')).getTime();
            if (expMs > 0 && expMs < new Date().getTime()) return c.json(401, { error: 'API token has expired' });
          }
          var tokUserId = String(tokRec.get('user') || '');
          var user = null;
          try { user = $app.findRecordById('users', tokUserId); } catch(e) {}
          if (!user) return c.json(401, { error: 'Token owner not found' });
          c.set('authRecord', user);
          c.set('apiTokenInfo', { token_id: tokRec.id, user_id: user.id, family_id: String(user.get('family_id') || ''), permissions: (function(){var rp='';try{rp=String(tokRec.getString('permissions')||'')}catch(e){}if(!rp||rp==='[]')try{rp=String(tokRec.getString('scopes')||'')}catch(e){}var ps=[];if(rp)try{ps=JSON.parse(rp)}catch(e){}return ps;})() });
        }
      }
    }

    var tokInfo = c.get('apiTokenInfo');
    var info = c.requestInfo();
    var userId = null;
    var familyId = '';

    if (tokInfo) {
      userId = tokInfo.user_id;
      familyId = tokInfo.family_id;
    } else {
      var auth = info && info.auth ? info.auth : null;
      if (!auth) return c.json(401, { error: 'Unauthorized' });
      userId = auth.id;
      familyId = String(auth.get('family_id') || '');
    }

    var taskId = c.request.pathValue('taskId');
    if (!taskId) return c.json(400, { error: 'taskId is required' });
    if (tokInfo) { var ps=tokInfo.permissions||[]; var ok=false; for(var pi=0;pi<ps.length;pi++){var pp=String(ps[pi]||''); if(pp==='*'||pp==='tasks:write'||pp==='tasks:*') ok=true;} if(!ok) return c.json(403, { error: 'Missing permission: tasks:write' }); }

    var rec = null;
    try { rec = $app.findRecordById('tasks', taskId); } catch(e) {}
    if (!rec) return c.json(404, { error: 'Task not found' });
    var ownerId=String(rec.get('user')||''); if(ownerId!==userId) return c.json(404,{error:'Not found'});

    var body = info.body || {};
    var changed = false;

    if (body.title !== undefined) { rec.set('title', String(body.title).trim() || rec.get('title')); changed = true; }
    if (body.status !== undefined) { rec.set('status', String(body.status)); changed = true; }
    if (body.description !== undefined) { rec.set('blocked_comment', String(body.description)); changed = true; }
    if (body.assigned_to !== undefined) { rec.set('assigned_to', String(body.assigned_to)); changed = true; }
    if (body.labels !== undefined && Array.isArray(body.labels)) {
      var labelIds = [];
      for (var li = 0; li < body.labels.length; li++) {
        var candidate = String(body.labels[li] || '').trim();
        if (candidate && labelIds.indexOf(candidate) === -1) labelIds.push(candidate);
      }
      for (var lvi = 0; lvi < labelIds.length; lvi++) {
        var label = null;
        try { label = $app.findRecordById('labels', labelIds[lvi]); } catch(e) {}
        if (!label) return c.json(400, { error: 'Invalid label' });
        var labelFamily = String(label.get('family') || '');
        if (familyId && labelFamily !== familyId) return c.json(403, { error: 'Label is outside your family' });
        var visibility = String(label.get('visibility') || (label.get('is_private') ? 'private' : 'family'));
        var labelOwner = String(label.get('owner') || label.get('user') || '');
        var sharedWith = label.get('shared_with') || [];
        if (!Array.isArray(sharedWith)) sharedWith = sharedWith ? [String(sharedWith)] : [];
        if (labelIds.length > 1 && visibility !== 'family') return c.json(403, { error: 'Multiple labels must all be family-visible' });
        if (visibility === 'private' && labelOwner !== userId) return c.json(403, { error: 'Private label is not accessible' });
        if (visibility === 'shared' && labelOwner !== userId && sharedWith.indexOf(userId) === -1) return c.json(403, { error: 'Shared label is not accessible' });
      }
      rec.set('labels', labelIds);
      rec.set('label', labelIds);
      changed = true;
    }
    if (body.due_date !== undefined) { rec.set('due_date', body.due_date ? String(body.due_date) : ''); changed = true; }
    if (body.priority !== undefined) { rec.set('priority', String(body.priority)); changed = true; }
    if (body.horizon !== undefined) { rec.set('horizon', String(body.horizon)); changed = true; }
    if (body.flag !== undefined) { rec.set('flag', body.flag === true || body.flag === 'true'); changed = true; }
    if (body.blocked !== undefined) { rec.set('blocked', body.blocked === true || body.blocked === 'true'); changed = true; }
    if (body.archived !== undefined) { rec.set('archived', body.archived === true || body.archived === 'true'); changed = true; }

    if (body.status === 'done' && String(rec.get('status') || '') !== 'done') {
      rec.set('completed_at', new Date().toISOString());
      changed = true;
    }

    if (!changed) return c.json(200, { id: taskId, message: 'No changes' });
    $app.save(rec);

    return c.json(200, {
      id: taskId,
      title: String(rec.get('title') || ''),
      status: String(rec.get('status') || 'todo'),
      updated: true
    });
  } catch(e) {
    try { $app.logger().error('api route error: ' + String(e)); } catch(_e) {}
    return c.json(500, { error: 'Internal server error' });
  }
});

// ─── PATCH /api/subtasks/{subtaskId} — Update subtask ───────────
routerAdd('PATCH', '/api/subtasks/{subtaskId}', function(c) {
  try {
    var authHeader = c.requestInfo().headers['authorization'];
    if (authHeader) {
      var parts = String(authHeader).split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer' && parts[1]) {
        var token = parts[1].trim();
        var hashed = $security.sha256(token);
        var tokens = $app.findRecordsByFilter('api_tokens', 'token_hash = {:hash}', '', 1, 0, { hash: hashed });
        if (tokens.length > 0) {
          var tokRec = tokens[0];
          var rawEnabled = tokRec.get('enabled');
          if (rawEnabled === false || rawEnabled === 0 || rawEnabled === 'false') return c.json(401, { error: 'API token is disabled' });
          var rawExp = tokRec.get('expires_at');
          if (rawExp) {
            var expMs = 0;
            if (typeof rawExp === 'string') expMs = new Date(String(rawExp).replace(' ', 'T')).getTime();
            else if (rawExp && typeof rawExp.getTime === 'function') expMs = rawExp.getTime();
            else if (rawExp) expMs = new Date(String(rawExp).replace(' ', 'T')).getTime();
            if (expMs > 0 && expMs < new Date().getTime()) return c.json(401, { error: 'API token has expired' });
          }
          var tokUserId = String(tokRec.get('user') || '');
          var user = null;
          try { user = $app.findRecordById('users', tokUserId); } catch(e) {}
          if (!user) return c.json(401, { error: 'Token owner not found' });
          c.set('authRecord', user);
          c.set('apiTokenInfo', { token_id: tokRec.id, user_id: user.id, family_id: String(user.get('family_id') || ''), permissions: (function(){var rp='';try{rp=String(tokRec.getString('permissions')||'')}catch(e){}if(!rp||rp==='[]')try{rp=String(tokRec.getString('scopes')||'')}catch(e){}var ps=[];if(rp)try{ps=JSON.parse(rp)}catch(e){}return ps;})() });
        }
      }
    }

    var tokInfo = c.get('apiTokenInfo');
    var info = c.requestInfo();
    var userId = null;
    var familyId = '';

    if (tokInfo) {
      userId = tokInfo.user_id;
      familyId = tokInfo.family_id;
    } else {
      var auth = info && info.auth ? info.auth : null;
      if (!auth) return c.json(401, { error: 'Unauthorized' });
      userId = auth.id;
      familyId = String(auth.get('family_id') || '');
    }

    var subtaskId = c.request.pathValue('subtaskId');
    if (!subtaskId) return c.json(400, { error: 'subtaskId is required' });
    if (tokInfo) { var ps=tokInfo.permissions||[]; var ok=false; for(var pi=0;pi<ps.length;pi++){var pp=String(ps[pi]||''); if(pp==='*'||pp==='tasks:write'||pp==='tasks:*') ok=true;} if(!ok) return c.json(403, { error: 'Missing permission: tasks:write' }); }

    var rec = null;
    try { rec = $app.findRecordById('tasks', subtaskId); } catch(e) {}
    if (!rec) return c.json(404, { error: 'Subtask not found' });
    var ownerId=String(rec.get('user')||''); if(ownerId!==userId) return c.json(404,{error:'Not found'});

    var body = info.body || {};
    var changed = false;

    if (body.title !== undefined) { rec.set('title', String(body.title).trim() || rec.get('title')); changed = true; }
    if (body.status !== undefined) { rec.set('status', String(body.status)); changed = true; }
    if (body.assigned_to !== undefined) { rec.set('assigned_to', String(body.assigned_to)); changed = true; }
    if (body.due_date !== undefined) { rec.set('due_date', body.due_date ? String(body.due_date) : ''); changed = true; }

    if (!changed) return c.json(200, { id: subtaskId, message: 'No changes' });
    $app.save(rec);

    return c.json(200, {
      id: subtaskId,
      title: String(rec.get('title') || ''),
      status: String(rec.get('status') || 'todo'),
      updated: true
    });
  } catch(e) {
    try { $app.logger().error('api route error: ' + String(e)); } catch(_e) {}
    return c.json(500, { error: 'Internal server error' });
  }
});

// ─── POST /api/groceries — Create grocery item ─────────────────
routerAdd('POST', '/api/groceries', function(c) {
  try {
    var authHeader = c.requestInfo().headers['authorization'];
    if (authHeader) {
      var parts = String(authHeader).split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer' && parts[1]) {
        var token = parts[1].trim();
        var hashed = $security.sha256(token);
        var tokens = $app.findRecordsByFilter('api_tokens', 'token_hash = {:hash}', '', 1, 0, { hash: hashed });
        if (tokens.length > 0) {
          var tokRec = tokens[0];
          var rawEnabled = tokRec.get('enabled');
          if (rawEnabled === false || rawEnabled === 0 || rawEnabled === 'false') return c.json(401, { error: 'API token is disabled' });
          var rawExp = tokRec.get('expires_at');
          if (rawExp) {
            var expMs = 0;
            if (typeof rawExp === 'string') expMs = new Date(String(rawExp).replace(' ', 'T')).getTime();
            else if (rawExp && typeof rawExp.getTime === 'function') expMs = rawExp.getTime();
            else if (rawExp) expMs = new Date(String(rawExp).replace(' ', 'T')).getTime();
            if (expMs > 0 && expMs < new Date().getTime()) return c.json(401, { error: 'API token has expired' });
          }
          var tokUserId = String(tokRec.get('user') || '');
          var user = null;
          try { user = $app.findRecordById('users', tokUserId); } catch(e) {}
          if (!user) return c.json(401, { error: 'Token owner not found' });
          c.set('authRecord', user);
          c.set('apiTokenInfo', { token_id: tokRec.id, user_id: user.id, family_id: String(user.get('family_id') || ''), permissions: (function(){var rp='';try{rp=String(tokRec.getString('permissions')||'')}catch(e){}if(!rp||rp==='[]')try{rp=String(tokRec.getString('scopes')||'')}catch(e){}var ps=[];if(rp)try{ps=JSON.parse(rp)}catch(e){}return ps;})() });
        }
      }
    }

    var tokInfo = c.get('apiTokenInfo');
    var info = c.requestInfo();
    var userId = null;
    var familyId = '';
    var isAgent = false;

    if (tokInfo) {
      userId = tokInfo.user_id;
      familyId = tokInfo.family_id;
      isAgent = true;
    } else {
      var auth = info && info.auth ? info.auth : null;
      if (!auth) return c.json(401, { error: 'Unauthorized' });
      userId = auth.id;
      familyId = String(auth.get('family_id') || '');
    }

    var body = info.body || {};
    var title = String(body.title || '').trim();
    if (!title) return c.json(400, { error: 'title is required' });

    if (tokInfo) { var ps=tokInfo.permissions||[]; var ok=false; for(var pi=0;pi<ps.length;pi++){var pp=String(ps[pi]||''); if(pp==='*'||pp==='groceries:write'||pp==='groceries:*') ok=true;} if(!ok) return c.json(403, { error: 'Missing permission: groceries:write' }); }
    var coll = $app.findCollectionByNameOrId('items');
    var rec = new Record(coll);
    rec.set('title', title);
    rec.set('completed', false);
    rec.set('quantity', body.quantity !== undefined ? parseInt(String(body.quantity), 10) || 1 : 1);
    rec.set('user', userId);
    if (body.shop_id) rec.set('shop_id', String(body.shop_id));
    if (body.labels && Array.isArray(body.labels)) rec.set('labels', body.labels);
    if (body.assigned_to) rec.set('assigned_to', String(body.assigned_to));
    if (body.due_date) rec.set('due_date', String(body.due_date));
    if (body.priority) rec.set('priority', String(body.priority));
    $app.save(rec);

    return c.json(201, {
      id: rec.id,
      title: String(rec.get('title') || ''),
      completed: false,
      quantity: rec.get('quantity') || 1,
      createdBy: userId,
      createdByType: isAgent ? 'agent' : 'user',
      workspaceId: familyId,
      shopId: body.shop_id || null,
      labels: body.labels || [],
      visibleToMembers: true
    });
  } catch(e) {
    try { $app.logger().error('api route error: ' + String(e)); } catch(_e) {}
    return c.json(500, { error: 'Internal server error' });
  }
});

// ─── PATCH /api/groceries/{itemId} — Update grocery item ─────────
routerAdd('PATCH', '/api/groceries/{itemId}', function(c) {
  try {
    var authHeader = c.requestInfo().headers['authorization'];
    if (authHeader) {
      var parts = String(authHeader).split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer' && parts[1]) {
        var token = parts[1].trim();
        var hashed = $security.sha256(token);
        var tokens = $app.findRecordsByFilter('api_tokens', 'token_hash = {:hash}', '', 1, 0, { hash: hashed });
        if (tokens.length > 0) {
          var tokRec = tokens[0];
          var rawEnabled = tokRec.get('enabled');
          if (rawEnabled === false || rawEnabled === 0 || rawEnabled === 'false') return c.json(401, { error: 'API token is disabled' });
          var rawExp = tokRec.get('expires_at');
          if (rawExp) {
            var expMs = 0;
            if (typeof rawExp === 'string') expMs = new Date(String(rawExp).replace(' ', 'T')).getTime();
            else if (rawExp && typeof rawExp.getTime === 'function') expMs = rawExp.getTime();
            else if (rawExp) expMs = new Date(String(rawExp).replace(' ', 'T')).getTime();
            if (expMs > 0 && expMs < new Date().getTime()) return c.json(401, { error: 'API token has expired' });
          }
          var tokUserId = String(tokRec.get('user') || '');
          var user = null;
          try { user = $app.findRecordById('users', tokUserId); } catch(e) {}
          if (!user) return c.json(401, { error: 'Token owner not found' });
          c.set('authRecord', user);
          c.set('apiTokenInfo', { token_id: tokRec.id, user_id: user.id, family_id: String(user.get('family_id') || ''), permissions: (function(){var rp='';try{rp=String(tokRec.getString('permissions')||'')}catch(e){}if(!rp||rp==='[]')try{rp=String(tokRec.getString('scopes')||'')}catch(e){}var ps=[];if(rp)try{ps=JSON.parse(rp)}catch(e){}return ps;})() });
        }
      }
    }

    var tokInfo = c.get('apiTokenInfo');
    var info = c.requestInfo();
    var userId = null;
    var familyId = '';

    if (tokInfo) {
      userId = tokInfo.user_id;
      familyId = tokInfo.family_id;
    } else {
      var auth = info && info.auth ? info.auth : null;
      if (!auth) return c.json(401, { error: 'Unauthorized' });
      userId = auth.id;
      familyId = String(auth.get('family_id') || '');
    }

    if (tokInfo) { var ps=tokInfo.permissions||[]; var ok=false; for(var pi=0;pi<ps.length;pi++){var pp=String(ps[pi]||''); if(pp==='*'||pp==='groceries:write'||pp==='groceries:*') ok=true;} if(!ok) return c.json(403, { error: 'Missing permission: groceries:write' }); }
    var itemId = c.request.pathValue('itemId');
    if (!itemId) return c.json(400, { error: 'itemId is required' });

    var rec = null;
    try { rec = $app.findRecordById('items', itemId); } catch(e) {}
    if (!rec) return c.json(404, { error: 'Grocery item not found' });
    var ownerId=String(rec.get('user')||''); if(ownerId!==userId) return c.json(404,{error:'Not found'});

    var body = info.body || {};
    var changed = false;

    if (body.title !== undefined) { rec.set('title', String(body.title).trim() || rec.get('title')); changed = true; }
    if (body.completed !== undefined) { rec.set('completed', body.completed === true || body.completed === 'true'); changed = true; }
    if (body.quantity !== undefined) { rec.set('quantity', parseInt(String(body.quantity), 10) || 1); changed = true; }
    if (body.shop_id !== undefined) { rec.set('shop_id', body.shop_id ? String(body.shop_id) : ''); changed = true; }
    if (body.assigned_to !== undefined) { rec.set('assigned_to', String(body.assigned_to)); changed = true; }
    if (body.due_date !== undefined) { rec.set('due_date', body.due_date ? String(body.due_date) : ''); changed = true; }
    if (body.priority !== undefined) { rec.set('priority', String(body.priority)); changed = true; }
    if (body.labels !== undefined && Array.isArray(body.labels)) { rec.set('labels', body.labels); changed = true; }

    if (!changed) return c.json(200, { id: itemId, message: 'No changes' });
    $app.save(rec);

    return c.json(200, {
      id: itemId,
      title: String(rec.get('title') || ''),
      completed: rec.get('completed') === true,
      quantity: rec.get('quantity') || 1,
      updated: true
    });
  } catch(e) {
    try { $app.logger().error('api route error: ' + String(e)); } catch(_e) {}
    return c.json(500, { error: 'Internal server error' });
  }
});

// ─── Token Management: Member API Tokens ──────────────────────

// GET /api/members/{userId}/token — Get token info for a member
routerAdd('GET', '/api/members/{userId}/token', function(c) {
  try {
    // Auth
    var authHeader = c.requestInfo().headers['authorization'];
    if (authHeader) {
      var parts = String(authHeader).split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer' && parts[1]) {
        var token = parts[1].trim();
        var hashed = $security.sha256(token);
        var tokens = $app.findRecordsByFilter('api_tokens', 'token_hash = {:hash}', '', 1, 0, { hash: hashed });
        if (tokens.length > 0) {
          var tokRec = tokens[0];
          var rawEnabled = tokRec.get('enabled');
          if (rawEnabled === false || rawEnabled === 0 || rawEnabled === 'false') return c.json(401, { error: 'API token is disabled' });
          var tokUserId = String(tokRec.get('user') || '');
          var user = null;
          try { user = $app.findRecordById('users', tokUserId); } catch(e) {}
          if (!user) return c.json(401, { error: 'Token owner not found' });
          c.set('authRecord', user);
          c.set('apiTokenInfo', { token_id: tokRec.id, user_id: user.id, user_role: String(user.get('role') || 'user'), family_id: String(user.get('family_id') || ''), permissions: (function(){var rp='';try{rp=String(tokRec.getString('permissions')||'')}catch(e){}if(!rp||rp==='[]')try{rp=String(tokRec.getString('scopes')||'')}catch(e){}var ps=[];if(rp)try{ps=JSON.parse(rp)}catch(e){}return ps;})() });
        }
      }
    }

    var tokInfo = c.get('apiTokenInfo');
    var userId = null;
    var familyId = '';
    var actingRole = '';

    if (tokInfo) {
      userId = tokInfo.user_id;
      familyId = tokInfo.family_id;
      actingRole = tokInfo.user_role;
    } else {
      var info = c.requestInfo();
      var auth = info && info.auth ? info.auth : null;
      if (!auth) return c.json(401, { error: 'Unauthorized' });
      userId = auth.id;
      familyId = String(auth.get('family_id') || '');
      actingRole = String(auth.get('role') || '');
    }

    var targetUserId = c.request.pathValue('userId');
    if (!targetUserId) return c.json(400, { error: 'userId is required' });

    // Only admins/owners can view other members' tokens — or the member themselves
    if (userId !== targetUserId && actingRole !== 'admin' && actingRole !== 'owner') {
      return c.json(403, { error: 'Admin only' });
    }

    var memberUser = null;
    try { memberUser = $app.findRecordById('users', targetUserId); } catch(e) {}
    if (!memberUser) return c.json(404, { error: 'Member not found' });
    var memberFamilyId = String(memberUser.get('family_id') || '');
    if (memberFamilyId && memberFamilyId !== familyId) {
      return c.json(403, { error: 'Access denied — member belongs to another family' });
    }

    // Find token — sort '' since api_tokens has no 'created' column
    var tokens = $app.findRecordsByFilter('api_tokens', 'user = {:userId}', '', 1, 0, { userId: targetUserId });
    if (tokens.length === 0) {
      return c.json(200, { hasToken: false, userId: targetUserId });
    }

    var t = tokens[0];
    var rawEnabled = t.get('enabled');
    var isEnabled = rawEnabled !== false && rawEnabled !== 0 && rawEnabled !== 'false';

    return c.json(200, {
      hasToken: true,
      userId: targetUserId,
      tokenId: t.id,
      tokenName: String(t.get('name') || ''),
      enabled: isEnabled,
      createdAt: t.get('created') || '',
      expiresAt: t.get('expires_at') || null
    });
  } catch(e) {
    try { $app.logger().error('api route error: ' + String(e)); } catch(_e) {}
    return c.json(500, { error: 'Internal server error' });
  }
});

// POST /api/members/{userId}/token — Create or regenerate token
routerAdd('POST', '/api/members/{userId}/token', function(c) {
  try {
    // Auth
    var authHeader = c.requestInfo().headers['authorization'];
    if (authHeader) {
      var parts = String(authHeader).split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer' && parts[1]) {
        var token = parts[1].trim();
        var hashed = $security.sha256(token);
        var tokens = $app.findRecordsByFilter('api_tokens', 'token_hash = {:hash}', '', 1, 0, { hash: hashed });
        if (tokens.length > 0) {
          var tokRec = tokens[0];
          var rawEnabled = tokRec.get('enabled');
          if (rawEnabled === false || rawEnabled === 0 || rawEnabled === 'false') return c.json(401, { error: 'API token is disabled' });
          var tokUserId = String(tokRec.get('user') || '');
          var user = null;
          try { user = $app.findRecordById('users', tokUserId); } catch(e) {}
          if (!user) return c.json(401, { error: 'Token owner not found' });
          c.set('authRecord', user);
          c.set('apiTokenInfo', { token_id: tokRec.id, user_id: user.id, user_role: String(user.get('role') || 'user'), family_id: String(user.get('family_id') || ''), permissions: (function(){var rp='';try{rp=String(tokRec.getString('permissions')||'')}catch(e){}if(!rp||rp==='[]')try{rp=String(tokRec.getString('scopes')||'')}catch(e){}var ps=[];if(rp)try{ps=JSON.parse(rp)}catch(e){}return ps;})() });
        }
      }
    }

    var tokInfo = c.get('apiTokenInfo');
    var actingUserId = null;
    var familyId = '';
    var actingRole = '';

    if (tokInfo) {
      actingUserId = tokInfo.user_id;
      familyId = tokInfo.family_id;
      actingRole = tokInfo.user_role;
    } else {
      var info = c.requestInfo();
      var auth = info && info.auth ? info.auth : null;
      if (!auth) return c.json(401, { error: 'Unauthorized' });
      actingUserId = auth.id;
      familyId = String(auth.get('family_id') || '');
      actingRole = String(auth.get('role') || '');
    }

    var targetUserId = c.request.pathValue('userId');
    if (!targetUserId) return c.json(400, { error: 'userId is required' });

    // Admin only
    if (tokInfo) return c.json(403, { error: 'API tokens cannot manage member tokens' });
    if (actingRole !== 'admin' && actingRole !== 'owner') {
      return c.json(403, { error: 'Admin only' });
    }

    // Verify member
    var memberUser = null;
    try { memberUser = $app.findRecordById('users', targetUserId); } catch(e) {}
    if (!memberUser) return c.json(404, { error: 'Member not found' });
    var memberFamilyId = String(memberUser.get('family_id') || '');
    if (memberFamilyId && memberFamilyId !== familyId) {
      return c.json(403, { error: 'Access denied' });
    }

    // Disable any existing tokens for this user
    var existingTokens = $app.findRecordsByFilter('api_tokens', 'user = {:userId}', '', 10000, 0, { userId: targetUserId });
    for (var ei = 0; ei < existingTokens.length; ei++) {
      existingTokens[ei].set('enabled', false);
      $app.save(existingTokens[ei]);
    }

    // Generate new token
    var newToken = 'tl_' + $security.randomString(48);
    var hash = $security.sha256(newToken);

    var coll = $app.findCollectionByNameOrId('api_tokens');
    var rec = new Record(coll);
    rec.set('name', 'API token for ' + String(memberUser.get('name') || memberUser.get('email') || targetUserId));
    rec.set('user', targetUserId);
    rec.set('token_hash', hash);
    rec.set('permissions', ['tasks:write', 'groceries:write', 'tasks:read', 'groceries:read']);
    rec.set('enabled', true);
    $app.save(rec);

    return c.json(201, {
      token: newToken,
      tokenId: rec.id,
      tokenName: String(rec.get('name') || ''),
      userId: targetUserId,
      scopes: ['tasks:write', 'groceries:write', 'tasks:read', 'groceries:read'],
      enabled: true
    });
  } catch(e) {
    try { $app.logger().error('api route error: ' + String(e)); } catch(_e) {}
    return c.json(500, { error: 'Internal server error' });
  }
});

// DELETE /api/members/{userId}/token — Revoke token
routerAdd('DELETE', '/api/members/{userId}/token', function(c) {
  try {
    // Auth
    var authHeader = c.requestInfo().headers['authorization'];
    if (authHeader) {
      var parts = String(authHeader).split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer' && parts[1]) {
        var token = parts[1].trim();
        var hashed = $security.sha256(token);
        var tokens = $app.findRecordsByFilter('api_tokens', 'token_hash = {:hash}', '', 1, 0, { hash: hashed });
        if (tokens.length > 0) {
          var tokRec = tokens[0];
          var rawEnabled = tokRec.get('enabled');
          if (rawEnabled === false || rawEnabled === 0 || rawEnabled === 'false') return c.json(401, { error: 'API token is disabled' });
          var tokUserId = String(tokRec.get('user') || '');
          var user = null;
          try { user = $app.findRecordById('users', tokUserId); } catch(e) {}
          if (!user) return c.json(401, { error: 'Token owner not found' });
          c.set('authRecord', user);
          c.set('apiTokenInfo', { token_id: tokRec.id, user_id: user.id, user_role: String(user.get('role') || 'user'), family_id: String(user.get('family_id') || ''), permissions: (function(){var rp='';try{rp=String(tokRec.getString('permissions')||'')}catch(e){}if(!rp||rp==='[]')try{rp=String(tokRec.getString('scopes')||'')}catch(e){}var ps=[];if(rp)try{ps=JSON.parse(rp)}catch(e){}return ps;})() });
        }
      }
    }

    var tokInfo = c.get('apiTokenInfo');
    var actingUserId = null;
    var familyId = '';
    var actingRole = '';

    if (tokInfo) {
      actingUserId = tokInfo.user_id;
      familyId = tokInfo.family_id;
      actingRole = tokInfo.user_role;
    } else {
      var info = c.requestInfo();
      var auth = info && info.auth ? info.auth : null;
      if (!auth) return c.json(401, { error: 'Unauthorized' });
      actingUserId = auth.id;
      familyId = String(auth.get('family_id') || '');
      actingRole = String(auth.get('role') || '');
    }

    var targetUserId = c.request.pathValue('userId');
    if (!targetUserId) return c.json(400, { error: 'userId is required' });

    // Admin only
    if (tokInfo) return c.json(403, { error: 'API tokens cannot manage member tokens' });
    if (actingRole !== 'admin' && actingRole !== 'owner') {
      return c.json(403, { error: 'Admin only' });
    }

    // Verify member
    var memberUser = null;
    try { memberUser = $app.findRecordById('users', targetUserId); } catch(e) {}
    if (!memberUser) return c.json(404, { error: 'Member not found' });
    var memberFamilyId = String(memberUser.get('family_id') || '');
    if (memberFamilyId && memberFamilyId !== familyId) {
      return c.json(403, { error: 'Access denied' });
    }

    // Disable all tokens for this user
    var existingTokens = $app.findRecordsByFilter('api_tokens', 'user = {:userId}', '', 10000, 0, { userId: targetUserId });
    var disabled = 0;
    for (var ei = 0; ei < existingTokens.length; ei++) {
      existingTokens[ei].set('enabled', false);
      $app.save(existingTokens[ei]);
      disabled++;
    }

    return c.json(200, {
      userId: targetUserId,
      tokensRevoked: disabled,
      message: 'All API tokens revoked for this member'
    });
  } catch(e) {
    try { $app.logger().error('api route error: ' + String(e)); } catch(_e) {}
    return c.json(500, { error: 'Internal server error' });
  }
});
