// A blocked or pending-approval account gets 403 on every /api/ route, even
// with a still-valid session (GH#98). Custom routes keep their own checks as
// defense in depth, and z068 adds the same condition to the read rules.
// Public routes and the auth endpoints stay reachable, so a blocked member
// can still sign in and see why their data calls fail.
//
// e.next() is deliberately not wrapped in try/catch: errors from later
// handlers (e.g. PocketBase's own 403s) must propagate unchanged.

routerUse(function (e) {
  var auth = null;
  try { auth = e.auth || null; } catch (_a) { auth = null; }
  if (!auth || !auth.id) return e.next();

  var path = '';
  try { path = String(e.request.url.path || ''); } catch (_p) {}

  // Reachable without an active account:
  if (path.indexOf('/api/') !== 0) return e.next();
  var open = ['/api/health', '/api/hook-health', '/api/setup-status', '/api/version', '/api/register',
              '/api/validate-invite', '/api/docs', '/api/swagger', '/api/openapi.json',
              '/api/integrations/mail/webhook'];
  for (var oi = 0; oi < open.length; oi++) {
    if (path === open[oi] || path.indexOf(open[oi] + '/') === 0) return e.next();
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