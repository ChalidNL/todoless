/// <reference path="../pb_data/types.d.ts" />

// Migration 018: Fix P10 security bugs
// 1. app_settings.listRule: remove public access — only authenticated users
// 2. users.createRule: enforce invite-only registration via hook check

migrate(
  (app) => {
    // Fix 1: app_settings — only authenticated users can list settings
    const settings = app.findCollectionByNameOrId('app_settings');
    settings.listRule = '@request.auth.id != ""';
    app.save(settings);

    const users = app.findCollectionByNameOrId('users');

    if (!users.fields.getByName('invite_code')) {
      users.fields.add(
        new TextField({
          name: 'invite_code',
          required: false,
        }),
      );
    }

    // Empty string = public auth collection create in PocketBase 0.26; invite-registration hook enforces first-admin/invite rules.
    users.createRule = '';
    app.save(users);
  },
  (app) => {
    // Rollback
    const settings = app.findCollectionByNameOrId('app_settings');
    settings.listRule = '';
    app.save(settings);

    const users = app.findCollectionByNameOrId('users');
    const inviteCodeField = users.fields.getByName('invite_code');
    if (inviteCodeField) {
      users.fields.remove(inviteCodeField.id);
    }
    users.createRule = '';
    app.save(users);
  }
);
