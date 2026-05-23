// Agent Task & Reminder endpoints - API-005 (PB 0.35 compatible)
// All helpers inline due to Goja module scope isolation.

// GET /api/agent/tasks
routerAdd('GET', '/api/agent/tasks', function(c) {
  function apiKey() {
    var info = c.requestInfo();
    var h = info.headers ? info.headers.Authorization : '';
    if (!h) return null;
    var p = String(h).split(' ');
    if (p.length !== 2 || p[0].toLowerCase() !== 'bearer') return null;
    var t = p[1].trim(); if (!t) return null;
    var recs = $app.findRecordsByFilter('api_tokens', 'token = {:token}', 'created', 1, 0, {token: t});
    return recs.length > 0 ? recs[0] : null;
  }
  function checkScope(k, scope) {
    var sc = String(k.get('scopes') || ''); if (!sc) return false;
    var list = sc.split(',');
    for (var i = 0; i < list.length; i++) { if (list[i].trim() === '*' || list[i].trim() === scope) return true; }
    return false;
  }
  function authCheck() {
    var key = apiKey(); if (!key) return 'Missing API key'; if (!key.get('active')) return 'Revoked';
    var ex = key.get('expires_at'); if (ex) { var em = new Date(String(ex)).getTime(); if (em > 0 && em < Date.now()) return 'Expired'; }
    var o = String(key.get('owner') || ''); if (!o) return 'No owner';
    var u = $app.findRecordById('users', o); if (!u) return 'User not found';
    var f = String(u.get('family_id') || ''); if (!f) return 'No family';
    return {uid: o, fid: f, key: key};
  }
  try {
    var a = authCheck(); if (typeof a === 'string') return c.json(401, {error: a});
    if (!checkScope(a.key, 'entries:read')) return c.json(403, {error: 'Missing scope'});
    var q = c.requestInfo().query || {};
    var s = String(q.status || '').trim();
    var filter = 'assigned_to = "' + a.uid + '"';
    if (s) filter += ' && status = "' + s + '"';
    var sort = String(q.sort || '-created');
    var tasks = $app.findRecordsByFilter('tasks', filter, sort, 100, 0);
    var r = [];
    for (var i = 0; i < tasks.length; i++) { var t = tasks[i]; r.push({id: t.id, title: t.get('title'), status: t.get('status'), created: String(t.get('created'))}); }
    return c.json(200, {tasks: r});
  } catch(e) { return c.json(500, {error: String(e)}); }
});

// PATCH /api/agent/tasks/:id
routerAdd('PATCH', '/api/agent/tasks/:id', function(c) {
  function apiKey() {
    var info = c.requestInfo(); var h = info.headers ? info.headers.Authorization : ''; if (!h) return null;
    var p = String(h).split(' '); if (p.length !== 2 || p[0].toLowerCase() !== 'bearer') return null;
    var t = p[1].trim(); if (!t) return null;
    var recs = $app.findRecordsByFilter('api_tokens', 'token = {:token}', 'created', 1, 0, {token: t});
    return recs.length > 0 ? recs[0] : null;
  }
  function checkScope(k, scope) {
    var sc = String(k.get('scopes') || ''); if (!sc) return false;
    var list = sc.split(','); for (var i = 0; i < list.length; i++) { if (list[i].trim() === '*' || list[i].trim() === scope) return true; } return false;
  }
  function authCheck() {
    var key = apiKey(); if (!key) return 'Missing API key'; if (!key.get('active')) return 'Revoked';
    var ex = key.get('expires_at'); if (ex) { var em = new Date(String(ex)).getTime(); if (em > 0 && em < Date.now()) return 'Expired'; }
    var o = String(key.get('owner') || ''); if (!o) return 'No owner';
    var u = $app.findRecordById('users', o); if (!u) return 'User not found';
    var f = String(u.get('family_id') || ''); if (!f) return 'No family';
    return {uid: o, fid: f, key: key};
  }
  try {
    var a = authCheck(); if (typeof a === 'string') return c.json(401, {error: a});
    if (!checkScope(a.key, 'entries:write')) return c.json(403, {error: 'Missing scope'});
    var id = c.pathParam('id');
    var t = $app.findRecordById('tasks', id); if (!t) return c.json(404, {error: 'Not found'});
    if (String(t.get('assigned_to') || '') !== a.uid) return c.json(403, {error: 'Not assigned'});
    var info = $apis.requestInfo(c);
    if (info && info.body && typeof info.body.get === 'function') {
      var ns = String(info.body.get('status') || '').trim();
      if (ns) { t.set('status', ns); if (ns === 'done') t.set('completed_at', new Date().toISOString()); }
    }
    $app.save(t);
    return c.json(200, {id: t.id, status: t.get('status')});
  } catch(e) { return c.json(500, {error: String(e)}); }
});

// POST /api/agent/reminders
routerAdd('POST', '/api/agent/reminders', function(c) {
  function apiKey() {
    var info = c.requestInfo(); var h = info.headers ? info.headers.Authorization : ''; if (!h) return null;
    var p = String(h).split(' '); if (p.length !== 2 || p[0].toLowerCase() !== 'bearer') return null;
    var t = p[1].trim(); if (!t) return null;
    var recs = $app.findRecordsByFilter('api_tokens', 'token = {:token}', 'created', 1, 0, {token: t});
    return recs.length > 0 ? recs[0] : null;
  }
  function checkScope(k, scope) {
    var sc = String(k.get('scopes') || ''); if (!sc) return false;
    var list = sc.split(','); for (var i = 0; i < list.length; i++) { if (list[i].trim() === '*' || list[i].trim() === scope) return true; } return false;
  }
  function authCheck() {
    var key = apiKey(); if (!key) return 'Missing API key'; if (!key.get('active')) return 'Revoked';
    var ex = key.get('expires_at'); if (ex) { var em = new Date(String(ex)).getTime(); if (em > 0 && em < Date.now()) return 'Expired'; }
    var o = String(key.get('owner') || ''); if (!o) return 'No owner';
    var u = $app.findRecordById('users', o); if (!u) return 'User not found';
    var f = String(u.get('family_id') || ''); if (!f) return 'No family';
    return {uid: o, fid: f, key: key};
  }
  try {
    var a = authCheck(); if (typeof a === 'string') return c.json(401, {error: a});
    if (!checkScope(a.key, 'entries:write')) return c.json(403, {error: 'Missing scope'});
    var info = $apis.requestInfo(c);
    if (!info || !info.body || typeof info.body.get !== 'function') return c.json(400, {error: 'Invalid body'});
    var title = String(info.body.get('title') || '').trim(); if (!title) return c.json(400, {error: 'Title required'});
    var rt = String(info.body.get('reminder_time') || '').trim(); if (!rt) return c.json(400, {error: 'reminder_time required'});
    var rec = $app.findRecordById('reminders', $security.randomString(15).toLowerCase());
    rec.set('title', title); rec.set('reminder_time', rt); rec.set('family_id', a.fid); rec.set('assigned_to', a.uid);
    $app.save(rec);
    return c.json(201, {id: rec.id, title: title, reminder_time: rt});
  } catch(e) { return c.json(500, {error: String(e)}); }
});

// GET /api/agent/reminders
routerAdd('GET', '/api/agent/reminders', function(c) {
  function apiKey() {
    var info = c.requestInfo(); var h = info.headers ? info.headers.Authorization : ''; if (!h) return null;
    var p = String(h).split(' '); if (p.length !== 2 || p[0].toLowerCase() !== 'bearer') return null;
    var t = p[1].trim(); if (!t) return null;
    var recs = $app.findRecordsByFilter('api_tokens', 'token = {:token}', 'created', 1, 0, {token: t});
    return recs.length > 0 ? recs[0] : null;
  }
  function checkScope(k, scope) {
    var sc = String(k.get('scopes') || ''); if (!sc) return false;
    var list = sc.split(','); for (var i = 0; i < list.length; i++) { if (list[i].trim() === '*' || list[i].trim() === scope) return true; } return false;
  }
  function authCheck() {
    var key = apiKey(); if (!key) return 'Missing API key'; if (!key.get('active')) return 'Revoked';
    var ex = key.get('expires_at'); if (ex) { var em = new Date(String(ex)).getTime(); if (em > 0 && em < Date.now()) return 'Expired'; }
    var o = String(key.get('owner') || ''); if (!o) return 'No owner';
    var u = $app.findRecordById('users', o); if (!u) return 'User not found';
    var f = String(u.get('family_id') || ''); if (!f) return 'No family';
    return {uid: o, fid: f, key: key};
  }
  try {
    var a = authCheck(); if (typeof a === 'string') return c.json(401, {error: a});
    if (!checkScope(a.key, 'entries:read')) return c.json(403, {error: 'Missing scope'});
    var q = c.requestInfo().query || {};
    var inc = String(q.include_fired || 'false').trim() === 'true';
    var filter = 'assigned_to = "' + a.uid + '"';
    if (!inc) filter += ' && reminder_time >= "' + new Date().toISOString() + '"';
    var rems = $app.findRecordsByFilter('reminders', filter, '-created', 100, 0);
    var r = [];
    for (var i = 0; i < rems.length; i++) { var rm = rems[i]; r.push({id: rm.id, title: rm.get('title'), reminder_time: String(rm.get('reminder_time'))}); }
    return c.json(200, {reminders: r});
  } catch(e) { return c.json(500, {error: String(e)}); }
});
