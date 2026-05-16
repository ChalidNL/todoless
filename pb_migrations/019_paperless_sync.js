migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('paperless_sync');
      return;
    } catch {}

    const tasksCollection = app.findCollectionByNameOrId('tasks');
    app.save(
      new Collection({
        name: 'paperless_sync',
        type: 'base',
        system: true,
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'document_id', type: 'number', required: true },
          { name: 'document_title', type: 'text' },
          { name: 'task_id', type: 'relation', collectionId: tasksCollection.id, cascadeDelete: false, maxSelect: 1 },
          { name: 'status', type: 'select', required: true, values: ['synced', 'skipped', 'error'], maxSelect: 1 },
          { name: 'error_message', type: 'text' },
        ],
        indexes: [
          'CREATE UNIQUE INDEX `idx_paperless_sync_document_id` ON `paperless_sync` (`document_id`)',
        ],
      }),
    );
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('paperless_sync');
      app.delete(collection);
    } catch {}
  },
);
