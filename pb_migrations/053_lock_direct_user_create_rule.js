migrate(
  function(app) {
    var users = app.findCollectionByNameOrId('users');
    // Direct PocketBase user creation must stay closed. Registration goes
    // through /api/register, where bootstrap/invite rules are enforced.
    users.createRule = null;
    app.save(users);
  },
  function(app) {
    // Intentionally a no-op (GH#36): rolling back this lock must NOT reopen
    // public registration. Direct user creation stays closed (null); signup is
    // only possible via /api/register, where bootstrap/invite rules are enforced.
  }
);
