// pb_hooks/lib/errors.js
// GH#9 — Shared error responder for custom PocketBase routes.
//
// PRD NFR-SEC-002 requires that unexpected exceptions never leak stack traces,
// secrets, or internal record details back to the client. Historically most
// custom routes ended with a catch block that returned the raw exception text
// (13_companion even returned the stack trace) and logged nothing server-side.
//
// This helper:
//   1. logs the REAL error server-side with route + user context — both to
//      stderr/stdout (visible in `docker logs`, Loki, Dozzle, ...) and to
//      `$app.logger()` (visible in PB's _logs / admin dashboard),
//   2. returns a GENERIC message to the client — never raw exception text.
//
// Handlers that construct their own client-facing validation/flow messages
// (e.g. BadRequestError-driven 400s) should keep doing so and must never pass
// raw exception text as `message`.
//
// Usage (matches pb_hooks/lib/auth.js convention):
//   var errorsLib = require(__hooks + '/lib/errors.js');
//   ...
//   } catch (e) { return errorsLib.respondError(c, e, 500); }
//
// The global `respondError(c, e, status, message, extra)` bound by
// pb_hooks/04_request_logger.pb.js delegates to this implementation, so live
// routes may also call it bare.

function respondError(c, e, status, message, extra) {
  var route = '';
  var userId = '';
  try {
    var info = c.requestInfo();
    route = String(info.method || '') + ' ' + String(info.path || info.url || '');
  } catch (_err) { /* request context may be unavailable */ }
  try {
    var auth = c.get('authRecord');
    if (auth) userId = String(auth.id || '');
  } catch (_err) { /* no auth record in context */ }

  var detail = '';
  try { detail = String((e && (e.message || e.stack)) || e); } catch (_err) { detail = String(e); }

  var line = '[respondError] ' + (route || '-') + (userId ? ' user=' + userId : '') + ': ' + detail;
  try { console.error(line); } catch (_c) { /* stdout must never break the request */ }
  try {
    $app.logger().error(line);
  } catch (_l) { /* logging must never break the request */ }

  var body = { error: message || 'Internal server error' };
  if (extra) {
    for (var key in extra) {
      if (Object.prototype.hasOwnProperty.call(extra, key)) body[key] = extra[key];
    }
  }
  return c.json(status || 500, body);
}

module.exports = {
  respondError: respondError,
};