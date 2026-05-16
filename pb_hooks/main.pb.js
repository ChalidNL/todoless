/// <reference path="../pb_data/types.d.ts" />

// PocketBase 0.26 loads only *.pb.js files from hooksDir.
// Keep the P10 security-critical hooks here so they are guaranteed to be active.

routerAdd('GET', '/api/todoless/hook-health', (c) => c.json(200, { ok: true }));

// Public bootstrap endpoint: exposes only first-run state, not app_settings records.
routerAdd('GET', '/api/todoless/setup-status', (c) => {
  try {
    const userRows = $app.findRecordsByFilter('users', '', '-created', 1, 0);
    const settingsRows = $app.findRecordsByFilter('app_settings', 'setup_complete = true', '-created', 1, 0);
    return c.json(200, {
      has_users: userRows.length > 0,
      setup_complete: settingsRows.length > 0,
    });
  } catch {
    return c.json(200, { has_users: true, setup_complete: false });
  }
});

// Invite-only registration: allow first admin bootstrap without invite; require invite after that.
onRecordCreateRequest((e) => {
  const existingUsers = $app.findRecordsByFilter('users', '', '-created', 1, 0);
  if (existingUsers.length === 0) {
    e.record.set('role', 'admin');
    e.record.set('family_id', '');
    if (typeof e.next === 'function') e.next();
    return;
  }

  const inviteCode = String(e.record.get('invite_code') || '').trim().toUpperCase().replace(/"/g, '');
  if (!inviteCode) {
    throw new BadRequestError('Invite code is required for registration.', {});
  }

  const now = new Date().toISOString();
  const inviteRecords = $app.findRecordsByFilter(
    'invite_codes',
    'code = "' + inviteCode + '" && used = false && expires_at > "' + now + '"',
    '-created',
    1,
    0,
  );

  if (inviteRecords.length === 0) {
    throw new BadRequestError('Invalid or expired invite code.', {});
  }

  e.record.set('role', 'user');
  e.record.set('family_id', '');

  if (typeof e.next === 'function') e.next();
}, 'users');

// Prevent direct collection API privilege escalation / family hopping.
// Family membership changes must go through controlled server endpoints, not self PATCH.
onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth && e.hasSuperuserAuth()) {
    if (typeof e.next === 'function') e.next();
    return;
  }

  const info = e.requestInfo();
  const body = info && info.body ? info.body : {};
  if (body.role !== undefined || body.family_id !== undefined || body.invite_code !== undefined) {
    throw new BadRequestError('Protected user fields cannot be changed directly.', {});
  }

  if (typeof e.next === 'function') e.next();
}, 'users');

onRecordAfterCreateSuccess((e) => {
  const inviteCode = String(e.record.get('invite_code') || '').trim().toUpperCase().replace(/"/g, '');
  if (!inviteCode) return;

  const inviteRecords = $app.findRecordsByFilter(
    'invite_codes',
    'code = "' + inviteCode + '" && used = false',
    '-created',
    1,
    0,
  );
  if (inviteRecords.length === 0) return;

  const inviteRecord = inviteRecords[0];
  inviteRecord.set('used', true);
  inviteRecord.set('used_at', new Date().toISOString());
  inviteRecord.set('used_by', e.record.id);
  $app.save(inviteRecord);
}, 'users');
