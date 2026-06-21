/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('companion_notifications');
      return;
    } catch {}

    const collection = new Collection({
      name: 'companion_notifications',
      type: 'base',
      listRule: 'user = @request.auth.id',
      viewRule: 'user = @request.auth.id',
      createRule: '@request.auth.id != ""',
      updateRule: 'user = @request.auth.id',
      deleteRule: 'user = @request.auth.id',
      fields: [
        {
          name: 'device_id',
          type: 'text',
          required: true,
          max: 255,
        },
        {
          name: 'title',
          type: 'text',
          required: true,
          max: 255,
        },
        {
          name: 'body',
          type: 'text',
          required: true,
          max: 2000,
        },
        {
          name: 'type',
          type: 'text',
          required: true,
          max: 64,
        },
        {
          name: 'task_id',
          type: 'text',
          required: false,
          max: 64,
        },
        {
          name: 'path',
          type: 'text',
          required: false,
          max: 255,
        },
        {
          name: 'source',
          type: 'text',
          required: false,
          max: 64,
        },
        {
          name: 'created_at',
          type: 'date',
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
        'CREATE INDEX `idx_companion_notifications_user` ON `companion_notifications` (`user`)',
        'CREATE INDEX `idx_companion_notifications_device_id` ON `companion_notifications` (`device_id`)',
        'CREATE INDEX `idx_companion_notifications_created_at` ON `companion_notifications` (`created_at`)',
      ],
    });

    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('companion_notifications');
      app.delete(collection);
    } catch {}
  },
);
