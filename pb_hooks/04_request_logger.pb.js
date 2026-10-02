// Request log on stdout/stderr (GH#56). PocketBase keeps request logs only in
// auxiliary.db, so `docker logs` and log collectors would see no backend
// traffic. One logfmt line per request (4xx/5xx on stderr and mirrored to
// $app.logger()), plus unhandled route exceptions, which are rethrown so
// PocketBase keeps its response semantics.
//
// Privacy: method, path without query, client IP and user id only.
//
// Route handlers report errors through lib/errors.js, required inside the
// handler: callbacks run in a separate VM that cannot see globals defined
// in this file (tests/gh9-error-leak.test.mjs guards it).

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
  // e.realIP() honours the trustedProxy settings (X-Forwarded-For, rightmost —
  // z069), so behind the bundled nginx this is the client, not the proxy.
  // e.request.remoteAddr would be the nginx container for every request.
  try {
    ip = String(e.realIP() || '').trim() || '-';
  } catch (r) {}
  if (ip === '-') {
    try {
      ip = String(e.request.remoteAddr || '-').split(':')[0] || '-';
    } catch (r) {}
  }
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