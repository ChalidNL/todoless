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
// Usage (matches pb_hooks/lib/auth.js convention) — require it INSIDE the
// handler, never rely on a global:
//   } catch (e) { return require(__hooks + '/lib/errors.js').respondError(c, e, 500); }
//
// Route callbacks run in PocketBase executor VMs that do not see globals
// defined by hook files (loader VM), so a bare `respondError(...)` throws
// ReferenceError there — see pb_hooks/04_request_logger.pb.js.

// A PocketBase ApiError with a 4xx status that was thrown on purpose - by a
// record hook (BadRequestError from the parent-link or date-sync checks) or
// by PocketBase's own validation inside $app.save() - and surfaced through
// the Goja exception as `e.value`. Its message is server-authored, never raw
// exception text, so it may go to the client with its own status. A 5xx or a
// plain Error is not a client error and keeps the generic path below.
function clientApiError(e) {
  try {
    var v = e && e.value;
    if (!v || typeof v !== 'object') return null;
    var st = Number(v.status);
    if (!(st >= 400 && st < 500)) return null;
    var msg = String(v.message || '').trim();
    if (!msg) return null;
    return { status: st, message: msg };
  } catch (_err) {
    return null;
  }
}

function respondError(c, e, status, message, extra) {
  // Validation refused inside the model layer is a 400 for the caller, not
  // an internal error (it used to come back as 500 "Internal server error"
  // from every custom route, e.g. #241's parent-link guard via /api/v1).
  var refused = (!status || status >= 500) && !message ? clientApiError(e) : null;
  if (refused) {
    try { console.warn('[respondError] client error ' + refused.status + ': ' + refused.message); } catch (_w) { /* never break the request */ }
    return c.json(refused.status, { error: refused.message });
  }
  var route = '';
  var userId = '';
  // Prefer the raw request (method + URL path): it is available even when the
  // exception came from c.requestInfo() itself (e.g. malformed JSON body).
  try {
    if (c.request) {
      var m = String(c.request.method || '');
      var pth = c.request.url ? String(c.request.url.path || '') : '';
      if (m || pth) route = m + ' ' + pth;
    }
  } catch (_err) { /* fall through to requestInfo */ }
  if (!route.trim()) {
    try {
      var info = c.requestInfo();
      route = String(info.method || '') + ' ' + String(info.path || info.url || '');
    } catch (_err) { /* request context may be unavailable */ }
  }
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