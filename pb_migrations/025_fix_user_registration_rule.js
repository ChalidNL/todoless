/// <reference path="../pb_data/types.d.ts" />

// PocketBase 0.26 uses empty string createRule for public auth collection registration.
// The invite-only policy is enforced in pb_hooks/main.pb.js onRecordCreateRequest.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.createRule = '';
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.createRule = null;
    app.save(users);
  },
);
