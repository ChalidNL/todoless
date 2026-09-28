migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.createRule = null;
    app.save(users);
  },
  (app) => {
    // Intentionally a no-op (GH#36): rolling back this lock must NOT reopen
    // public registration. Direct user creation stays closed (null); signup is
    // only possible via /api/register, where bootstrap/invite rules are enforced.
  }
);
