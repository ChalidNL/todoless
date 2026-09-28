// pb_hooks/13_companion.pb.js
// Doneday Companion: local-first device registration + realtime notification events.
//
// PocketBase serialises route handlers and re-evaluates them in a pooled
// executor VM, so helper functions defined at file top level (or pinned to
// globalThis) are NOT visible inside handlers — every companion request used
// to 500 with `ReferenceError: _companionRequireAuth is not defined` (GH#8).
// All shared logic now lives in pb_hooks/lib/companion.js and is require()d
// INSIDE each handler, mirroring pb_hooks/12_api_routes.pb.js + lib/auth.js.

function registerCompanionDeviceHandler(c) {
  try {
    var companion = require(__hooks + '/lib/companion.js');
    var authResult = companion.requireAuth(c);
    if (authResult.error) return authResult.error;

    var result = companion.registerDevice(authResult.auth, authResult.info.body || {});
    if (result.error) return c.json(result.error.status, result.error.body);

    return c.json(result.created ? 201 : 200, {
      ok: true,
      created: result.created,
      deliveryMode: 'pocketbase-realtime',
      device: companion.deviceResponse(result.record),
    });
  } catch (e) {
    return respondError(c, e, 500);
  }
}

function createCompanionTestNotificationHandler(c) {
  try {
    var companion = require(__hooks + '/lib/companion.js');
    var authResult = companion.requireAuth(c);
    if (authResult.error) return authResult.error;

    var body = authResult.info.body || {};
    var payload = {
      deviceId: body.deviceId || body.device_id,
      title: body.title || 'Doneday dev notification',
      body: body.body || 'Local-first companion notification received.',
      type: body.type || 'task',
      taskId: body.taskId || body.task_id || '',
      path: body.path || '',
      source: body.source || 'dev-test',
      createdAt: body.createdAt || body.created_at || companion.nowIso(),
    };

    var emitted = companion.emitNotification(authResult.auth, payload);
    if (emitted.error) return c.json(emitted.error.status, emitted.error.body);

    return c.json(201, {
      ok: true,
      deliveryMode: 'pocketbase-realtime',
      notification: emitted.payload,
    });
  } catch (e) {
    return respondError(c, e, 500);
  }
}

routerAdd('POST', '/api/companion/devices/register', registerCompanionDeviceHandler);
routerAdd('POST', '/api/companion/notifications/test', createCompanionTestNotificationHandler);
