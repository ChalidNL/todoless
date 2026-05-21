/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    // Add first_name field
    if (!users.fields.getByName('first_name')) {
      users.fields.add(new TextField({
        name: 'first_name',
        required: false,
        max: 255,
      }));
    }

    // Add last_name field
    if (!users.fields.getByName('last_name')) {
      users.fields.add(new TextField({
        name: 'last_name',
        required: false,
        max: 255,
      }));
    }

    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    if (users.fields.getByName('first_name')) users.fields.remove('first_name');
    if (users.fields.getByName('last_name')) users.fields.remove('last_name');
    app.save(users);
  },
);
