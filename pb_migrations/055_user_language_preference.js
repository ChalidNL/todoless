/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    if (!users.fields.getByName('language')) {
      users.fields.add(new SelectField({
        name: 'language',
        values: ['nl', 'fr', 'en', 'de', 'es'],
        maxSelect: 1,
        required: true,
      }));
    }

    app.save(users);

    const allUsers = app.findRecordsByFilter('users', '', '', 0, 0);
    for (const user of allUsers) {
      const current = String(user.get('language') || '');
      if (['nl', 'fr', 'en', 'de', 'es'].indexOf(current) === -1) {
        user.set('language', 'en');
        app.save(user);
      }
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const field = users.fields.getByName('language');
    if (field) {
      users.fields.removeById(field.id);
      app.save(users);
    }
  },
);
