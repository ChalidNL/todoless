migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('briefings');
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
        name: 'briefings',
        type: 'base',
        ...baseRules,
        fields: [
          { name: 'date', type: 'text', required: true }, // YYYY-MM-DD string for daily dedup
          { name: 'data', type: 'json', required: true }, // Full briefing JSON blob
          { name: 'generated_at', type: 'date', required: true },
          { name: 'user', type: 'relation', required: true, collectionId: '_pb_users_auth_', cascadeDelete: true, maxSelect: 1 },
        ],
      }),
    );
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('briefings');
      app.delete(collection);
    } catch {}
  },
);
