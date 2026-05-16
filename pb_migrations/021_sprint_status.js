migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('sprints');

    // Add status field: planned, active, completed
    if (!collection.fields.getByName('status')) {
      collection.fields.add(
        new SelectField({
          name: 'status',
          required: true,
          values: ['planned', 'active', 'completed'],
          maxSelect: 1,
          default: 'planned',
        }),
      );
    }

    // Add goal field for sprint commitment
    if (!collection.fields.getByName('goal')) {
      collection.fields.add(
        new NumberField({
          name: 'goal',
          required: false,
          min: 0,
        }),
      );
    }

    app.save(collection);

    // Also add sprint_id to tasks relation if not already present
    // (it should be from the projects migration, but ensure it exists)
    const tasksCollection = app.findCollectionByNameOrId('tasks');
    const hasSprintId = tasksCollection.fields.getByName('sprint_id');
    if (!hasSprintId) {
      tasksCollection.fields.add(
        new RelationField({
          name: 'sprint_id',
          collectionId: collection.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      );
    }
    app.save(tasksCollection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('sprints');
    const statusField = collection.fields.getByName('status');
    if (statusField) collection.fields.remove(statusField.id);
    const goalField = collection.fields.getByName('goal');
    if (goalField) collection.fields.remove(goalField.id);
    app.save(collection);
  },
);
