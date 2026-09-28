// pb_hooks/04_request_logger.pb.js
// GH#56 — Make PocketBase request/error logs available on stdout / log collector.
//
// PocketBase stores request logs only in auxiliary.db (`_logs`, 5-day retention)
// and does NOT print them to stdout by default. Docker-log setups (Loki/promtail,
// Dozzle, Portainer) therefore see zero backend traffic, and errors thrown from
// custom routes are swallowed (only a bare 4xx/5xx response, nothing logged).
//
// This hook registers a global `routerUse` middleware that:
//   1. prints every request to stdout (2xx/3xx) or stderr (4xx/5xx) in a single
//      logfmt-style line — captured by `docker logs`, Loki, promtail, Dozzle, ...
//   2. mirrors 4xx/5xx to `$app.logger()` so they also land in `_logs` at a
//      warn/error level (visible in the admin dashboard + /api/logs API)
//   3. logs unhandled exceptions thrown from any route handler (previously
//      silently swallowed) and rethrows them so PocketBase keeps its response
//      semantics (e.g. BadRequestError -> 400).
//
// Verified against PB 0.35.1 JSVM: routerUse((e) => ...), e.status(), console.*,
// $app.logger().* key/value args.
//
// Privacy: logs method + path only (no query string, no headers, no body),
// remote IP and authenticated user id — never passwords/tokens/invite codes.

routerUse(function (e) {
  var startMs = Date.now();

  // Honor LOG_LEVEL (entrypoint env, default "info"): info/dur lines are only
  // emitted at info|debug|trace; warn/error lines are always emitted because
  // 4xx/5xx visibility is the point of this hook.
  var logLevel = 'info';
  try {
    var rawLevel = String($os.getenv('LOG_LEVEL') || 'info').toLowerCase();
    if (['debug', 'info', 'warn', 'error', 'trace'].indexOf(rawLevel) !== -1) {
      logLevel = rawLevel;
    }
  } catch (r) {}
  var emitInfo = (logLevel === 'debug' || logLevel === 'info' || logLevel === 'trace');

  // Collect safe request metadata before the handler runs.
  var method = '?';
  var path = '?';
  var ip = '-';
  var authId = '-';
  try {
    method = String(e.request.method || '?');
  } catch (r) {}
  try {
    path = String(e.request.url.path || '?');
  } catch (r) {}
  try {
    ip = String(e.request.remoteAddr || '-').split(':')[0] || '-';
  } catch (r) {}
  try {
    if (e.auth && e.auth.id) authId = String(e.auth.id);
  } catch (r) {}

  var kv = function (extra) {
    var line = '[pb-request] ts=' + new Date().toISOString() +
      ' level=' + extra.level +
      ' method=' + method +
      ' path=' + path +
      ' status=' + extra.status +
      ' duration_ms=' + (Date.now() - startMs) +
      ' ip=' + ip +
      ' auth=' + authId;
    if (extra.error !== undefined) {
      line += ' error="' + String(extra.error).replace(/"/g, '\\"') + '"';
    }
    return line;
  };

  try {
    e.next();
  } catch (err) {
    // Unhandled error from a custom route handler. Log it with the real
    // response status when the error carries one (PB ApiErrors expose
    // `err.value.status`, e.g. 400/403/404/418), then rethrow so PocketBase
    // returns the same response it would have without this hook.
    var errMsg = (err && err.message) ? String(err.message) : String(err);
    var errStatus = 500;
    try {
      if (err && err.value && Number(err.value.status)) errStatus = Number(err.value.status);
    } catch (r) {}
    var line = kv({ level: 'error', status: errStatus, error: errMsg });
    try { console.error(line); } catch (c) {}
    try {
      $app.logger().error(
        'unhandled route error',
        'method', method,
        'path', path,
        'error', errMsg,
        'status', errStatus
      );
    } catch (l) {}
    throw err;
  }

  // Skip pure liveness checks from the info stream (health checks spam a line
  // every few seconds); 4xx/5xx from /api/health are still logged below.
  var status = 0;
  try { status = Number(e.status()) || 0; } catch (r) {}

  var isHealth = path === '/api/health';
  try {
    if (status >= 500) {
      var line5xx = kv({ level: 'error', status: status });
      try { console.error(line5xx); } catch (c) {}
      $app.logger().error(
        'failed request',
        'method', method,
        'path', path,
        'status', status
      );
    } else if (status >= 400) {
      var line4xx = kv({ level: 'warn', status: status });
      try { console.warn(line4xx); } catch (c) {}
      $app.logger().warn(
        'client error request',
        'method', method,
        'path', path,
        'status', status
      );
    } else if (!isHealth && emitInfo) {
      var lineOk = kv({ level: 'info', status: status });
      try { console.log(lineOk); } catch (c) {}
    }
  } catch (l) {
    // never let logging break the request
  }
});