/// <reference path="../../pb_data/types.d.ts" />

// Invite-only registration hook
// Allows exactly the first user (admin bootstrap) without an invite.
// All later public user registrations require a valid, unused, non-expired invite code.

onRecordBeforeCreateRequest('users', (e) => {
  const existingUsers = $app.dao().findRecordsByFilter('users', '', '-created', 1, 0);
  const isFirstUser = existingUsers.length === 0;

  if (isFirstUser) {
    return;
  }

  const inviteCode = String(e.record.get('invite_code') || '').trim().toUpperCase();

  if (!inviteCode) {
    throw new BadRequestError('Invite code is required for registration.', {});
  }

  const now = new Date().toISOString();

  // Find a valid invite code matching the provided code
  const inviteRecords = $app.dao().findRecordsByFilter(
    'invite_codes',
    'code = "' + inviteCode.replace(/"/g, '') + '" && used = false && expires_at > "' + now + '"',
    '-created',
    1,
    0
  );

  if (inviteRecords.length === 0) {
    throw new BadRequestError('Invalid or expired invite code.', {});
  }

  // Mark the invite code as used
  const inviteRecord = inviteRecords[0];
  const updateAction = new RecordUpsertAction($app, inviteRecord);
  updateAction.set('used', true);
  updateAction.set('used_at', now);
  updateAction.set('used_by', e.record.id);
  updateAction.submit();
});
