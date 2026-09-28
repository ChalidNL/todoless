/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Guard: skip if the collection already exists (idempotent re-run)
    try {
      app.findCollectionByNameOrId('agent_keys');
      return;
    } catch {}

    const collection = new Collection({
      name: 'agent_keys',
      type: 'base',
      listRule: 'user = @request.auth.id',
      viewRule: 'user = @request.auth.id',
      createRule: '@request.auth.id != ""',
      updateRule: 'user = @request.auth.id',
      deleteRule: 'user = @request.auth.id',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
        },
        {
          name: 'key_hash',
          type: 'text',
          required: true,
        },
        {
          name: 'key_prefix',
          type: 'text',
          required: true,
        },
        {
          name: 'scopes',
          type: 'json',
          required: true,
        },
        {
          name: 'active',
          type: 'bool',
          required: true,
        },
        {
          name: 'last_used_at',
          type: 'date',
          required: false,
        },
        {
          name: 'expires_at',
          type: 'date',
          required: false,
        },
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_agent_keys_hash` ON `agent_keys` (`key_hash`)',
      ],
    });

    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('agent_keys');
      app.delete(collection);
    } catch {}
  },
);
