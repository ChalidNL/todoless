// pb_hooks/16_bootstrap.pb.js
// GH#75 — single family-scoped GET /api/bootstrap for app boot.
//
// Replaces the frontend's 14-request boot sequence (refreshAll) with one call.
// Returns raw PocketBase records for exactly the collections the UI renders at
// boot: tasks, items, notes, labels, shops, users, invites, reminders,
// settings. Sprints/rewards/goals/projects/calendar_events/briefings/entries
// are NOT included — components never render them from boot state.
//
// Privacy: $app.findRecordsByFilter does NOT enforce collection listRules, so
// this route re-applies the same visibility semantics the SDK list rules
// enforce:
//   - tasks:  canAccessTaskForUser() from lib/auth.js (is_private + label rules)
//   - items:  owner OR (non-private AND owner in same family)
//   - labels: canAccessLabel() — owner/user match OR family match AND
//             (visibility 'family' OR 'shared' containing the caller OR
//              'private' owned by the caller)

routerAdd('GET', '/api/bootstrap', (c) => {
  var authLib = require(__hooks + '/lib/auth.js');
  var bearerAuthMiddleware = authLib.bearerAuthMiddleware;
  var canAccessTaskForUser = authLib.canAccessTaskForUser;

  // Mirrors the label visibility semantics of the SDK listRules (owner first,
  // then family-scoped, then visibility rules).
  function canAccessLabel(record, auth, fid, uid) {
    if (!record) return false;
    var owner = String(record.get('owner') || record.get('user') || '');
    if (owner === uid) return true;
    if (!fid) return false;
    var lf = String(record.get('family') || '');
    if (!lf && owner) {
      try { lf = String($app.findRecordById('users', owner).get('family_id') || ''); } catch (e) { return false; }
    }
    if (lf !== fid) return false;
    // visibility is a REQUIRED field backfilled by z061, so the fallback
    // default below only applies to schema-invalid legacy rows; it mirrors the
    // app-wide normalizeLabel() default so bootstrap == SDK for valid data.
    var vis = String(record.get('visibility') || (record.get('is_private') ? 'private' : 'family'));
    if (vis === 'family') return true;
    if (vis === 'shared') {
      var sw = record.get('shared_with') || [];
      if (!Array.isArray(sw)) sw = sw ? [String(sw)] : [];
      return sw.indexOf(uid) !== -1;
    }
    return false;
  }

  // Mirrors the items listRule: owner sees all; family sees non-private.
  function canAccessItem(record, auth, fid, uid) {
    if (!record) return false;
    var owner = String(record.get('user') || '');
    if (owner === uid) return true;
    if (record.get('is_private') === true || record.get('is_private') === 1 || record.get('is_private') === 'true') return false;
    if (!fid || !owner) return false;
    try { return String($app.findRecordById('users', owner).get('family_id') || '') === fid; } catch (e) { return false; }
  }

try {
    var ba = bearerAuthMiddleware(c);
    if (ba) return ba;
    var info = c.requestInfo();
    var auth = (info && info.auth) || c.get('authRecord');
    if (!auth) return c.json(401, { error: 'Unauthorized' });
    var tokInfo = c.get('apiTokenInfo');
    function _hasPerm(req) {
      if (!tokInfo) return true;
      var ps = tokInfo.permissions || [];
      for (var pi = 0; pi < ps.length; pi++) {
        var p = String(ps[pi] || '');
        if (p === req || p === '*') return true;
        var a = p.split(':'), b = req.split(':');
        if (a.length === 2 && b.length === 2 && a[0] === b[0] && a[1] === '*') return true;
      }
      return false;
    }
    if (!_hasPerm('entries:read') && !_hasPerm('tasks:read') && !_hasPerm('groceries:read')) return c.json(403, { error: 'Missing read permission' });

    var uid = String(auth.id || '');
    var fid = String(auth.get('family_id') || '');

    var tasks = $app.findRecordsByFilter('tasks', fid ? 'user.family_id = {:fid}' : 'user.id = {:uid}', '-created', 10000, 0, { fid: fid, uid: uid })
      .filter(function (r) { return canAccessTaskForUser(r, auth); });

    var items = $app.findRecordsByFilter('items', fid ? 'user.family_id = {:fid}' : 'user.id = {:uid}', '-created', 10000, 0, { fid: fid, uid: uid })
      .filter(function (r) { return canAccessItem(r, auth, fid, uid); });

    var notes = $app.findRecordsByFilter('notes', 'user.id = {:uid}', '-created', 10000, 0, { uid: uid });

    var labels = $app.findRecordsByFilter(
      'labels',
      fid ? 'family = {:fid} || user.family_id = {:fid} || owner = {:uid}' : 'user.id = {:uid} || owner = {:uid}',
      'name', 10000, 0, { fid: fid, uid: uid }
    ).filter(function (r) { return canAccessLabel(r, auth, fid, uid); });

    var shops = $app.findRecordsByFilter('shops', fid ? 'user.family_id = {:fid}' : 'user.id = {:uid}', 'name', 10000, 0, { fid: fid, uid: uid });

    var users = $app.findRecordsByFilter('users', fid ? 'id = {:uid} || family_id = {:fid}' : 'id = {:uid}', 'name', 10000, 0, { fid: fid, uid: uid });

    var invites = $app.findRecordsByFilter('invite_codes', 'user.id = {:uid}', '-created', 10000, 0, { uid: uid });

    var reminders = $app.findRecordsByFilter('reminders', 'user = {:uid}', 'reminder_time', 10000, 0, { uid: uid });

    // Single record or null — do NOT create settings server-side (the frontend
    // creates its default when the boot payload has none).
    var settingsRecs = $app.findRecordsByFilter('app_settings', 'user = {:uid}', '', 1, 0, { uid: uid });
    var settings = settingsRecs.length > 0 ? settingsRecs[0] : null;

    return c.json(200, {
      tasks: tasks,
      items: items,
      notes: notes,
      labels: labels,
      shops: shops,
      users: users,
      invites: invites,
      reminders: reminders,
      settings: settings,
    });
  } catch (e) {
    // GH#9: log the real error server-side, return a generic body (no String(e)).
    return respondError(c, e, 500);
  }
});