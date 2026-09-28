migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('notes');

    // @assignee — relation to user
    if (!collection.fields.getByName('assigned_to')) {
      collection.fields.add(
        new Field({
          name: 'assigned_to',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        }),
      );
    }

    // //due date
    if (!collection.fields.getByName('due_date')) {
      collection.fields.add(
        new Field({
          name: 'due_date',
          type: 'date',
        }),
      );
    }

    // //recurring interval
    if (!collection.fields.getByName('repeat_interval')) {
      collection.fields.add(
        new Field({
          name: 'repeat_interval',
          type: 'select',
          values: ['week', 'month', 'year'],
          maxSelect: 1,
        }),
      );
    }

    // !!private
    if (!collection.fields.getByName('is_private')) {
      collection.fields.add(
        new Field({
          name: 'is_private',
          type: 'bool',
        }),
      );
    }

    // ~linked (multiple links — JSON array of IDs)
    if (!collection.fields.getByName('linked_ids')) {
      collection.fields.add(
        new Field({
          name: 'linked_ids',
          type: 'json',
        }),
      );
    }

    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('notes');
    for (const fieldName of ['assigned_to', 'due_date', 'repeat_interval', 'is_private', 'linked_ids']) {
      try {
        collection.fields.remove(fieldName);
      } catch {}
    }
    app.save(collection);
  },
);