// pb_hooks/15_member_status_gate.pb.js
// GH#98 follow-up (t_318f2396): enforce member_status on PocketBase's native
// API read/write paths.
//
// Root cause: the /api/v1 and /api/entries handlers trusted `info.auth`
// without re-checking member_status, and PB's native /api/collections/* reads
// only gate via listRule — which PocketBase applies as a SQL *filter*, so a
// blocked member with a still-valid token got HTTP 200 with an (empty) page
// instead of 401/403.
//
// This global routerUse middleware answers 403 for a blocked or
// pending-approval account on every native records/files request
// (/api/collections/*, /api/files/*), before PB's own handlers run. Auth
// endpoints (login, refresh, verification, password reset, impersonate,
// external OAuth) stay reachable so a blocked member can still authenticate
// and receive the 'Account is blocked' error from their first data call.
//
// IMPORTANT: e.next() must NOT be wrapped in try/catch. If the downstream
// handler throws (e.g. PB's 403 "Only superusers..." delete denial), the
// exception must propagate up the middleware chain untouched — swallowing it
// and re-calling next() turns PB errors into silent 200 responses.
//
// Custom routes (/api/v1, /api/entries, companion, agent, ...) enforce
// member_status in their own handlers — see main.pb.js and 13_companion.pb.js.
//
// The z068 migration additionally conjoins the same status guard into every
// member-readable listRule/viewRule as defense-in-depth at the data layer.

routerUse(function (e) {
  var auth = null;
  try { auth = e.auth || null; } catch (_a) { auth = null; }
  if (!auth || !auth.id) return e.next();

  var path = '';
  try { path = String(e.request.url.path || ''); } catch (_p) {}

  // Only gate PocketBase's native records/files API here.
  if (path.indexOf('/api/collections/') !== 0 && path.indexOf('/api/files/') !== 0) {
    return e.next();
  }
  // Keep authentication-related endpoints reachable for blocked accounts.
  if (path.indexOf('/auth-') !== -1 ||
      path.indexOf('/request-') !== -1 ||
      path.indexOf('/confirm-') !== -1 ||
      path.indexOf('/impersonate') !== -1 ||
      path.indexOf('/_external') !== -1) {
    return e.next();
  }

  var ms = '';
  try { ms = String(auth.get('member_status') || ''); } catch (_m) {}
  if (ms === 'blocked') return e.json(403, { error: 'Account is blocked' });
  if (ms === 'pending_approval') return e.json(403, { error: 'Account is pending approval' });

  return e.next();
});