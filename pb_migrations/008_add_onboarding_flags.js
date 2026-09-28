/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId('app_settings');

  // Add setup_complete flag — set globally once first admin setup is done
  if (!collection.fields.getByName('setup_complete')) {
    collection.fields.add(
      new BoolField({
        name: 'setup_complete',
        required: false,
      }),
    );
  }

  app.save(collection);
}, (app) => {
  // Rollback
  const collection = app.findCollectionByNameOrId('app_settings');
  const field = collection.fields.getByName('setup_complete');
  if (field) {
    collection.fields.remove(field);
    app.save(collection);
  }
});
