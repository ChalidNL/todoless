/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Guard: skip if already exists (idempotent)
    try {
      app.findCollectionByNameOrId('api_tokens');
      return;
    } catch {}

    const collection = new Collection({
      name: 'api_tokens',
      type: 'base',
      listRule: 'user = @request.auth.id',
      viewRule: 'user = @request.auth.id',
      createRule: '@request.auth.id != ""',
      updateRule: null,   // no updates — tokens are created and revoked only
      deleteRule: 'user = @request.auth.id',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          max: 256,
        },
        {
          name: 'token_hash',
          type: 'text',
          required: true,
          max: 128,
        },
        {
          name: 'permissions',
          type: 'json',
          required: true,
        },
        {
          name: 'expires_at',
          type: 'date',
          required: false,
        },
        {
          name: 'enabled',
          type: 'bool',
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
        'CREATE INDEX `idx_api_tokens_token_hash` ON `api_tokens` (`token_hash`)',
        'CREATE INDEX `idx_api_tokens_user` ON `api_tokens` (`user`)',
      ],
    });

    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('api_tokens');
      app.delete(collection);
    } catch {}
  },
);
