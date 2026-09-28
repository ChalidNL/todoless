/// <reference path="../pb_data/types.d.ts" />

// GH#27: user deletion must go through the audited member-management action so
// retention/ownership transfer runs before the auth record is removed.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.deleteRule = null;
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.deleteRule = 'id = @request.auth.id';
    app.save(users);
  },
);
