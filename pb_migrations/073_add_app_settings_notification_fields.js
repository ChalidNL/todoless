/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('app_settings');

    // Notification preference fields (GH#69) — previously PocketBase silently
    // dropped unknown fields on write, so the toggles never persisted.
    if (!collection.fields.getByName('notification_email')) {
      collection.fields.add(
        new BoolField({
          name: 'notification_email',
          required: false,
        }),
      );
    }

    if (!collection.fields.getByName('notification_push')) {
      collection.fields.add(
        new BoolField({
          name: 'notification_push',
          required: false,
        }),
      );
    }

    if (!collection.fields.getByName('task_reminders')) {
      collection.fields.add(
        new BoolField({
          name: 'task_reminders',
          required: false,
        }),
      );
    }

    if (!collection.fields.getByName('reminder_minutes')) {
      collection.fields.add(
        new NumberField({
          name: 'reminder_minutes',
          required: false,
          onlyInt: true,
          min: 1,
        }),
      );
    }

    if (!collection.fields.getByName('briefing_enabled')) {
      collection.fields.add(
        new BoolField({
          name: 'briefing_enabled',
          required: false,
        }),
      );
    }

    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('app_settings');
    for (const name of ['notification_email', 'notification_push', 'task_reminders', 'reminder_minutes', 'briefing_enabled']) {
      try {
        collection.fields.remove(collection.fields.getByName(name));
      } catch {}
    }
    app.save(collection);
  },
);