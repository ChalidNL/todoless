migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('tasks');

    if (!collection.fields.getByName('completed_by')) {
      collection.fields.add(
        new RelationField({
          name: 'completed_by',
          required: false,
          maxSelect: 1,
          collectionId: app.findCollectionByNameOrId('users').id,
          cascadeDelete: false,
        }),
      );
    }

    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('tasks');
    try {
      collection.fields.remove(collection.fields.getByName('completed_by'));
    } catch {}
    app.save(collection);
  },
);
