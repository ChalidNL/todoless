// Guard direct PocketBase collection API writes to auth-user privilege fields.
// Custom server-side routes (for example /api/register and /api/v1 admin actions)
// mutate users via $app.save() and do not go through *Request hooks.

function handleUsersPrivilegeCreateRequest(e) {
  var info = null;
  try {
    if (e && typeof e.requestInfo === 'function') info = e.requestInfo();
    else if (e && e.requestInfo) info = e.requestInfo;
  } catch (_) {
    info = null;
  }

  var body = {};
  if (info) body = info.data || info.body || {};

  var blocked = ['role', 'member_status', 'family_id', 'member_type'];
  for (var i = 0; i < blocked.length; i++) {
    var field = blocked[i];
    if (body && Object.prototype.hasOwnProperty.call(body, field)) {
      var message = 'Direct user create cannot set privileged field: ' + field;
      var details = { field: field };
      if (e && typeof e.badRequestError === 'function') throw e.badRequestError(message, details);
      throw new BadRequestError(message, details);
    }
  }

  if (e && typeof e.next === 'function') return e.next();
}

function handleUsersPrivilegeUpdateRequest(e) {
  var info = null;
  try {
    if (e && typeof e.requestInfo === 'function') info = e.requestInfo();
    else if (e && e.requestInfo) info = e.requestInfo;
  } catch (_) {
    info = null;
  }

  var body = {};
  if (info) body = info.data || info.body || {};

  var blocked = ['role', 'member_status', 'family_id', 'member_type'];
  for (var i = 0; i < blocked.length; i++) {
    var field = blocked[i];
    if (body && Object.prototype.hasOwnProperty.call(body, field)) {
      var message = 'Direct user update cannot set privileged field: ' + field;
      var details = { field: field };
      if (e && typeof e.badRequestError === 'function') throw e.badRequestError(message, details);
      throw new BadRequestError(message, details);
    }
  }

  if (e && typeof e.next === 'function') return e.next();
}

if (typeof onRecordCreateRequest === 'function') {
  onRecordCreateRequest(handleUsersPrivilegeCreateRequest, 'users');
} else if (typeof onRecordBeforeCreateRequest === 'function') {
  onRecordBeforeCreateRequest('users', handleUsersPrivilegeCreateRequest);
}

if (typeof onRecordUpdateRequest === 'function') {
  onRecordUpdateRequest(handleUsersPrivilegeUpdateRequest, 'users');
} else if (typeof onRecordBeforeUpdateRequest === 'function') {
  onRecordBeforeUpdateRequest('users', handleUsersPrivilegeUpdateRequest);
}
