migrate(
  function(app) {
    var users = app.findCollectionByNameOrId('users');
    // Direct PocketBase user creation must stay closed. Registration goes
    // through /api/register, where bootstrap/invite rules are enforced.
    users.createRule = null;
    app.save(users);
  },
  function(app) {
    var users = app.findCollectionByNameOrId('users');
    users.createRule = '';
    app.save(users);
  }
);
