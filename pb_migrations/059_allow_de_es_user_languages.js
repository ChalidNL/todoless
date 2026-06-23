/// <reference path="../pb_data/types.d.ts" />

const USER_LANGUAGE_VALUES = ['nl', 'fr', 'en', 'de', 'es'];
const PREVIOUS_USER_LANGUAGE_VALUES = ['nl', 'fr', 'en'];

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const field = users.fields.getByName('language');

    if (!field) {
      users.fields.add(new SelectField({
        name: 'language',
        values: USER_LANGUAGE_VALUES,
        maxSelect: 1,
        required: true,
      }));
    } else {
      field.values = USER_LANGUAGE_VALUES;
      field.maxSelect = 1;
      field.required = true;
    }

    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const field = users.fields.getByName('language');
    if (!field) return;

    const allUsers = app.findRecordsByFilter('users', '', '', 0, 0);
    for (const user of allUsers) {
      const current = String(user.get('language') || '');
      if (PREVIOUS_USER_LANGUAGE_VALUES.indexOf(current) === -1) {
        user.set('language', 'en');
        app.save(user);
      }
    }

    field.values = PREVIOUS_USER_LANGUAGE_VALUES;
    field.maxSelect = 1;
    field.required = true;
    app.save(users);
  },
);
