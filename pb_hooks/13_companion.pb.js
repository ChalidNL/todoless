// pb_hooks/13_companion.pb.js
// Doneday Companion: local-first device registration + realtime notification events.

function _companionSafeString(value) {
  return String(value || '').trim();
}

function _companionOptionalString(value) {
  var normalized = _companionSafeString(value);
  return normalized ? normalized : '';
}

function _companionNowIso() {
  return new Date().toISOString();
}

function _companionEscapeFilter(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function _companionRequireAuth(c) {
  var info = c.requestInfo();
  var auth = info && info.auth ? info.auth : null;
  if (!auth) auth = c.get('authRecord');
  if (!auth) return { error: c.json(401, { error: 'Unauthorized' }) };

  var memberStatus = '';
  try { memberStatus = String(auth.get('member_status') || ''); } catch (e) {}
  if (memberStatus === 'blocked') return { error: c.json(403, { error: 'Account is blocked' }) };
  if (memberStatus === 'pending_approval') return { error: c.json(403, { error: 'Account is pending approval' }) };

  return { info: info, auth: auth };
}

function updateDeviceLastSeen(record, isoDate) {
  record.set('last_seen', isoDate || _companionNowIso());
  return record;
}

function _companionDeviceResponse(record) {
  return {
    id: record.id,
    deviceId: _companionOptionalString(record.get('device_id')),
    deviceName: _companionOptionalString(record.get('device_name')),
    platform: _companionOptionalString(record.get('platform')),
    osVersion: _companionOptionalString(record.get('os_version')),
    appVersion: _companionOptionalString(record.get('app_version')),
    pushToken: _companionOptionalString(record.get('push_token')),
    userId: _companionOptionalString(record.get('user')),
    registrationDate: record.get('registration_date'),
    lastSeen: record.get('last_seen'),
  };
}

function prepareCompanionNotificationPayload(input) {
  var source = input || {};
  var title = _companionSafeString(source.title);
  var body = _companionSafeString(source.body);
  var type = _companionSafeString(source.type) || 'task';
  var taskId = _companionOptionalString(source.taskId || source.task_id);
  var path = _companionOptionalString(source.path);
  var createdAt = _companionOptionalString(source.createdAt || source.created_at) || _companionNowIso();

  if (!path && taskId) {
    path = '/tasks/' + taskId;
  }

  return {
    title: title,
    body: body,
    type: type,
    taskId: taskId,
    path: path,
    createdAt: createdAt,
  };
}

function registerDevice(auth, body) {
  var payload = body || {};
  var deviceId = _companionSafeString(payload.deviceId || payload.device_id);
  var deviceName = _companionOptionalString(payload.deviceName || payload.device_name);
  var platform = _companionSafeString(payload.platform);
  var osVersion = _companionOptionalString(payload.osVersion || payload.os_version);
  var appVersion = _companionOptionalString(payload.appVersion || payload.app_version);
  var pushToken = _companionOptionalString(payload.pushToken || payload.push_token) || 'local-realtime';

  if (!deviceId) {
    return { error: { status: 400, body: { error: 'deviceId is required' } } };
  }
  if (!platform) {
    return { error: { status: 400, body: { error: 'platform is required' } } };
  }

  var userId = String(auth.id || '');
  var now = _companionNowIso();
  var filter = 'user = "' + _companionEscapeFilter(userId) + '" && device_id = "' + _companionEscapeFilter(deviceId) + '"';
  var existing = $app.findRecordsByFilter('companion_devices', filter, '', 1, 0);
  var coll = $app.findCollectionByNameOrId('companion_devices');
  var record = existing.length > 0 ? existing[0] : new Record(coll);
  var created = existing.length === 0;

  if (created) {
    record.set('user', userId);
    record.set('registration_date', now);
  }

  record.set('device_id', deviceId);
  record.set('device_name', deviceName);
  record.set('platform', platform);
  record.set('os_version', osVersion);
  record.set('app_version', appVersion);
  record.set('push_token', pushToken);
  updateDeviceLastSeen(record, now);
  $app.save(record);

  return {
    created: created,
    record: record,
  };
}

function emitCompanionNotification(auth, input) {
  var payload = input || {};
  var prepared = prepareCompanionNotificationPayload(payload);
  var deviceId = _companionSafeString(payload.deviceId || payload.device_id);
  var userId = String(auth.id || payload.userId || payload.user_id || '');

  if (!userId) {
    return { error: { status: 400, body: { error: 'userId is required' } } };
  }
  if (!deviceId) {
    return { error: { status: 400, body: { error: 'deviceId is required' } } };
  }
  if (!prepared.title) {
    return { error: { status: 400, body: { error: 'title is required' } } };
  }
  if (!prepared.body) {
    return { error: { status: 400, body: { error: 'body is required' } } };
  }

  var coll = $app.findCollectionByNameOrId('companion_notifications');
  var record = new Record(coll);
  record.set('user', userId);
  record.set('device_id', deviceId);
  record.set('title', prepared.title);
  record.set('body', prepared.body);
  record.set('type', prepared.type || 'task');
  record.set('task_id', prepared.taskId || '');
  record.set('path', prepared.path || '');
  record.set('source', _companionOptionalString(payload.source) || 'backend');
  record.set('created_at', prepared.createdAt || _companionNowIso());
  $app.save(record);

  return {
    record: record,
    payload: {
      id: record.id,
      deviceId: _companionOptionalString(record.get('device_id')),
      title: _companionOptionalString(record.get('title')),
      body: _companionOptionalString(record.get('body')),
      type: _companionOptionalString(record.get('type')),
      taskId: _companionOptionalString(record.get('task_id')),
      path: _companionOptionalString(record.get('path')),
      source: _companionOptionalString(record.get('source')),
      createdAt: record.get('created_at'),
      userId: _companionOptionalString(record.get('user')),
    },
  };
}

function registerCompanionDeviceHandler(c) {
  try {
    var authResult = _companionRequireAuth(c);
    if (authResult.error) return authResult.error;

    var result = registerDevice(authResult.auth, authResult.info.body || {});
    if (result.error) return c.json(result.error.status, result.error.body);

    return c.json(result.created ? 201 : 200, {
      ok: true,
      created: result.created,
      deliveryMode: 'pocketbase-realtime',
      device: _companionDeviceResponse(result.record),
    });
  } catch (e) {
    return c.json(500, { error: String(e), stack: String(e.stack || '') });
  }
}

function createCompanionTestNotificationHandler(c) {
  try {
    var authResult = _companionRequireAuth(c);
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
      createdAt: body.createdAt || body.created_at || _companionNowIso(),
    };

    var emitted = emitCompanionNotification(authResult.auth, payload);
    if (emitted.error) return c.json(emitted.error.status, emitted.error.body);

    return c.json(201, {
      ok: true,
      deliveryMode: 'pocketbase-realtime',
      notification: emitted.payload,
    });
  } catch (e) {
    return c.json(500, { error: String(e), stack: String(e.stack || '') });
  }
}

routerAdd('POST', '/api/companion/devices/register', registerCompanionDeviceHandler);
routerAdd('POST', '/api/companion/notifications/test', createCompanionTestNotificationHandler);

globalThis._companionSafeString = _companionSafeString;
globalThis._companionOptionalString = _companionOptionalString;
globalThis._companionNowIso = _companionNowIso;
globalThis._companionEscapeFilter = _companionEscapeFilter;
globalThis._companionRequireAuth = _companionRequireAuth;
globalThis._companionDeviceResponse = _companionDeviceResponse;
globalThis.registerDevice = registerDevice;
globalThis.updateDeviceLastSeen = updateDeviceLastSeen;
globalThis.prepareCompanionNotificationPayload = prepareCompanionNotificationPayload;
globalThis.emitCompanionNotification = emitCompanionNotification;
