migrate(
  (app) => {
    // Guard: skip if the collection already exists (idempotent re-run)
    try {
      app.findCollectionByNameOrId('integrations');
      return;
    } catch {}

    app.save(
      new Collection({
        name: 'integrations',
        type: 'base',
        listRule: 'user = @request.auth.id',
        viewRule: 'user = @request.auth.id',
        createRule: '@request.auth.id != ""',
        updateRule: 'user = @request.auth.id',
        deleteRule: 'user = @request.auth.id',
        fields: [
          { name: 'type', type: 'select', required: true, values: ['home_assistant', 'actual_budget', 'custom'], maxSelect: 1 },
          { name: 'api_url', type: 'url', required: true },
          { name: 'api_key', type: 'text', required: false },
          { name: 'config_data', type: 'json' },
          { name: 'enabled', type: 'bool' },
          { name: 'last_sync', type: 'date' },
          { name: 'user', type: 'relation', required: true, collectionId: '_pb_users_auth_', cascadeDelete: true, maxSelect: 1 },
        ],
        indexes: [
          'CREATE UNIQUE INDEX `idx_integrations_user_type` ON `integrations` (`user`, `type`)',
        ],
      }),
    );
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('integrations');
      app.delete(collection);
    } catch {}
  },
);
