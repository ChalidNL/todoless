migrate(
  (app) => {
    const families = app.findRecordsByFilter('families', '', '', 0, 0);
    const unsafe = app.unsafeWithoutHooks();

    for (const family of families) {
      const familyId = family.id;
      const createdBy = String(family.get('created_by') || '');
      const admins = app.findRecordsByFilter(
        'users',
        'family_id = "' + familyId + '" && (role = "admin" || role = "owner")',
        'created',
        0,
        0
      );

      if (admins.length <= 1) continue;

      let keepId = admins[0].id;
      if (createdBy && admins.some((user) => user.id === createdBy)) {
        keepId = createdBy;
      }

      for (const user of admins) {
        if (user.id === keepId) continue;
        user.set('role', 'member');
        unsafe.save(user);
      }
    }
  },
  () => {
    // No-op rollback: role restoration would be lossy.
  }
);
