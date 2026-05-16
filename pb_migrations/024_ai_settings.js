migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('ai_settings');
      return;
    } catch {}

    app.save(
      new Collection({
        name: 'ai_settings',
        type: 'base',
        system: false,
        listRule: 'user = @request.auth.id',
        viewRule: 'user = @request.auth.id',
        createRule: '@request.auth.id != ""',
        updateRule: 'user = @request.auth.id',
        deleteRule: 'user = @request.auth.id',
        fields: [
          { name: 'provider', type: 'select', required: true, values: ['openai', 'openrouter', 'ollama', 'custom'], maxSelect: 1 },
          { name: 'api_url', type: 'url', required: true },
          { name: 'api_key', type: 'text', required: false },
          { name: 'model', type: 'text', required: true },
          { name: 'max_tokens', type: 'number', required: false },
          { name: 'temperature', type: 'number', required: false },
          { name: 'enabled', type: 'bool', required: true },
          { name: 'user', type: 'relation', required: true, collectionId: '_pb_users_auth_', cascadeDelete: true, maxSelect: 1 },
        ],
        indexes: [
          'CREATE UNIQUE INDEX `idx_ai_settings_user` ON `ai_settings` (`user`)',
        ],
      }),
    );
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('ai_settings');
      app.delete(collection);
    } catch {}
  },
);
