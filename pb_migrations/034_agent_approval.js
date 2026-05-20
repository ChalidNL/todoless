/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    if (!users.fields.getByName('agent_status')) {
      users.fields.add(new SelectField({
        name: 'agent_status',
        values: ['pending', 'approved', 'rejected'],
        maxSelect: 1,
      }));
      app.save(users);
    }
  },
  (app) => {
    try {
      const users = app.findCollectionByNameOrId('users');
      const f = users.fields.getByName('agent_status');
      if (f) {
        users.fields.removeById(f.id);
        app.save(users);
      }
    } catch {}
  },
);
