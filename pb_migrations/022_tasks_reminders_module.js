migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('tasks');

    // ~linked — what this task is linked to (relation to another task)
    if (!collection.fields.getByName('linked_to')) {
      collection.fields.add(
        new RelationField({
          name: 'linked_to',
          collectionId: collection.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      );
    }

    // ~linked — type of the linked entity (task or item)
    if (!collection.fields.getByName('linked_type')) {
      collection.fields.add(
        new SelectField({
          name: 'linked_type',
          values: ['task', 'item', 'note'],
          maxSelect: 1,
        }),
      );
    }

    // flag — visual flag/reminder marker on the task
    if (!collection.fields.getByName('flag')) {
      collection.fields.add(
        new BoolField({
          name: 'flag',
        }),
      );
    }

    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('tasks');
    for (const name of ['linked_to', 'linked_type', 'flag']) {
      try {
        collection.fields.remove(collection.fields.getByName(name));
      } catch {}
    }
    app.save(collection);
  },
);
