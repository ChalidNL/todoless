// Test-only hook, loaded by scripts/test-registration-and-roles.sh next to the
// repo hooks (never by the app): the save of a user named FAILPOINT fails, which
// stands in for anything that can fail between two writes of one role change
// (validation, disk, restart) and lets tests/registration/set-role-atomic.py
// check that set_role commits all of its writes or none (#269).
onRecordUpdate((e) => {
  if (String(e.record.get('name') || '') === 'FAILPOINT') throw new BadRequestError('failpoint: save refused', {});
  e.next();
}, 'users');
