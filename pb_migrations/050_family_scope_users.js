migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const rule = 'id = @request.auth.id || (family_id != "" && family_id = @request.auth.family_id)';
    users.listRule = rule;
    users.viewRule = rule;
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.listRule = '@request.auth.id != ""';
    users.viewRule = '@request.auth.id != ""';
    app.save(users);
  }
);
