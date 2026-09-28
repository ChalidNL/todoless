/// <reference path="../pb_data/types.d.ts" />

// Migration 010: Open user registration (see note)
// PocketBase auth collection rule semantics: null = superuser-only (closed),
// '' (empty string) = public (anyone can register).
// NOTE: this migration set createRule = null, which actually CLOSES direct
// registration (contrary to the name). 012 later opened it with ''
// (public, invite-enforced by the /api/register hook), and 051/053 locked it
// back to null. Behavior is intentionally left unchanged for applied installs.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.createRule = null;
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.createRule = '';
    app.save(users);
  },
);
