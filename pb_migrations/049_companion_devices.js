/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('companion_devices');
      return;
    } catch {}

    const collection = new Collection({
      name: 'companion_devices',
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
          name: 'device_name',
          type: 'text',
          required: false,
          max: 255,
        },
        {
          name: 'platform',
          type: 'text',
          required: true,
          max: 64,
        },
        {
          name: 'os_version',
          type: 'text',
          required: false,
          max: 128,
        },
        {
          name: 'app_version',
          type: 'text',
          required: false,
          max: 64,
        },
        {
          name: 'push_token',
          type: 'text',
          required: true,
          max: 2048,
        },
        {
          name: 'registration_date',
          type: 'date',
          required: true,
        },
        {
          name: 'last_seen',
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
        'CREATE UNIQUE INDEX `idx_companion_devices_user_device` ON `companion_devices` (`user`, `device_id`)',
        'CREATE INDEX `idx_companion_devices_push_token` ON `companion_devices` (`push_token`)',
        'CREATE INDEX `idx_companion_devices_user` ON `companion_devices` (`user`)',
      ],
    });

    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('companion_devices');
      app.delete(collection);
    } catch {}
  },
);
