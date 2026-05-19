/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    // Add agent_status field — controls agent registration approval flow
    // Default is 'approved' so existing users keep full access
    if (!users.fields.find(f => f.name === 'agent_status')) {
      users.fields.push({
        name: 'agent_status',
        type: 'select',
        required: false,
        options: {
          maxSelect: 1,
          values: ['pending', 'approved', 'rejected'],
        },
      });
      app.save(users);
    }
  },
  (app) => {
    try {
      const users = app.findCollectionByNameOrId('users');
      users.fields = users.fields.filter(f => f.name !== 'agent_status');
      app.save(users);
    } catch {}
  },
);