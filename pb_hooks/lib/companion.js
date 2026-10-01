// pb_hooks/lib/companion.js
// Shared helpers for the Doneday Companion endpoints (device registration +
// local-first realtime notification events).
//
// PocketBase serialises route handlers and re-evaluates them in a pooled
// executor VM: top-level functions from the loader scope and anything pinned
// to globalThis are NOT visible inside handlers, which made every companion
// call 500 with `ReferenceError` (GH#8). Load this module INSIDE each route
// handler with:
//     var companion = require(__hooks + '/lib/companion.js');

function safeString(value) {
  return String(value || '').trim();
}

function optionalString(value) {
  var normalized = safeString(value);
  return normalized ? normalized : '';
}

function nowIso() {
  return new Date().toISOString();
}

function escapeFilter(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function requireAuth(c) {
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
  record.set('last_seen', isoDate || nowIso());
  return record;
}

function deviceResponse(record) {
  return {
    id: record.id,
    deviceId: optionalString(record.get('device_id')),
    deviceName: optionalString(record.get('device_name')),
    platform: optionalString(record.get('platform')),
    osVersion: optionalString(record.get('os_version')),
    appVersion: optionalString(record.get('app_version')),
    pushToken: optionalString(record.get('push_token')),
    userId: optionalString(record.get('user')),
    registrationDate: record.get('registration_date'),
    lastSeen: record.get('last_seen'),
  };
}

function prepareNotificationPayload(input) {
  var source = input || {};
  var title = safeString(source.title);
  var body = safeString(source.body);
  var type = safeString(source.type) || 'task';
  var taskId = optionalString(source.taskId || source.task_id);
  var path = optionalString(source.path);
  var createdAt = optionalString(source.createdAt || source.created_at) || nowIso();

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
  var deviceId = safeString(payload.deviceId || payload.device_id);
  var deviceName = optionalString(payload.deviceName || payload.device_name);
  var platform = safeString(payload.platform);
  var osVersion = optionalString(payload.osVersion || payload.os_version);
  var appVersion = optionalString(payload.appVersion || payload.app_version);
  var pushToken = optionalString(payload.pushToken || payload.push_token) || 'local-realtime';

  if (!deviceId) {
    return { error: { status: 400, body: { error: 'deviceId is required' } } };
  }
  if (!platform) {
    return { error: { status: 400, body: { error: 'platform is required' } } };
  }

  var userId = String(auth.id || '');
  var now = nowIso();
  // Bound parameters instead of string concatenation (the rest of pb_hooks
  // uses {:param} binding; escapeFilter stays exported for existing callers).
  var existing = $app.findRecordsByFilter('companion_devices', 'user = {:user} && device_id = {:device}', '', 1, 0, { user: userId, device: deviceId });
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

function emitNotification(auth, input) {
  var payload = input || {};
  var prepared = prepareNotificationPayload(payload);
  var deviceId = safeString(payload.deviceId || payload.device_id);
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
  record.set('source', optionalString(payload.source) || 'backend');
  record.set('created_at', prepared.createdAt || nowIso());
  $app.save(record);

  return {
    record: record,
    payload: {
      id: record.id,
      deviceId: optionalString(record.get('device_id')),
      title: optionalString(record.get('title')),
      body: optionalString(record.get('body')),
      type: optionalString(record.get('type')),
      taskId: optionalString(record.get('task_id')),
      path: optionalString(record.get('path')),
      source: optionalString(record.get('source')),
      createdAt: record.get('created_at'),
      userId: optionalString(record.get('user')),
    },
  };
}

module.exports = {
  safeString: safeString,
  optionalString: optionalString,
  nowIso: nowIso,
  escapeFilter: escapeFilter,
  requireAuth: requireAuth,
  updateDeviceLastSeen: updateDeviceLastSeen,
  deviceResponse: deviceResponse,
  prepareNotificationPayload: prepareNotificationPayload,
  registerDevice: registerDevice,
  emitNotification: emitNotification,
};
