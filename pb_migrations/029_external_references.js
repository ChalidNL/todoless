/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Generic external reference model.
    // Links any TodoLess entity (task, grocery, note) to an entity in an external system.
    // Polymorphic via entity_type + entity_id (text fields, not relations).
    const collection = new Collection({
      name: 'external_references',
      type: 'base',
      listRule: 'user = @request.auth.id',
      viewRule: 'user = @request.auth.id',
      createRule: '@request.auth.id != ""',
      updateRule: 'user = @request.auth.id',
      deleteRule: 'user = @request.auth.id',
      fields: [
        {
          name: 'source',
          type: 'select',
          required: true,
          values: ['paperless', 'home_assistant', 'gmail', 'custom'],
          maxSelect: 1,
        },
        {
          name: 'external_id',
          type: 'text',
          required: true,
        },
        {
          name: 'external_url',
          type: 'url',
          required: false,
        },
        {
          name: 'sync_status',
          type: 'select',
          required: true,
          values: ['synced', 'pending', 'error', 'orphaned'],
          maxSelect: 1,
        },
        {
          name: 'last_synced_at',
          type: 'date',
          required: false,
        },
        {
          name: 'entity_type',
          type: 'select',
          required: true,
          values: ['task', 'grocery', 'note'],
          maxSelect: 1,
        },
        {
          name: 'entity_id',
          type: 'text',
          required: true,
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
        'CREATE UNIQUE INDEX `idx_ext_ref_source_external` ON `external_references` (`source`, `external_id`)',
        'CREATE INDEX `idx_ext_ref_entity` ON `external_references` (`entity_type`, `entity_id`)',
      ],
    });

    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('external_references');
      app.delete(collection);
    } catch {}
  },
);
