migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('reminders');
      return;
    } catch {}

    const baseRules = {
      listRule: 'user = @request.auth.id',
      viewRule: 'user = @request.auth.id',
      createRule: '@request.auth.id != ""',
      updateRule: 'user = @request.auth.id',
      deleteRule: 'user = @request.auth.id',
    };

    app.save(
      new Collection({
        name: 'reminders',
        type: 'base',
        ...baseRules,
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'message', type: 'text' },
          { name: 'reminder_time', type: 'date', required: true },
          { name: 'fired', type: 'bool' },
          { name: 'dismissed', type: 'bool' },
          { name: 'linked_type', type: 'select', values: ['task', 'item'], maxSelect: 1 },
          { name: 'linked_to', type: 'text' },
          { name: 'repeat_interval', type: 'select', values: ['hour', 'day', 'week', 'month', 'year'], maxSelect: 1 },
          { name: 'user', type: 'relation', required: true, collectionId: '_pb_users_auth_', cascadeDelete: true, maxSelect: 1 },
        ],
      }),
    );
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('reminders');
      app.delete(collection);
    } catch {}
  },
);
