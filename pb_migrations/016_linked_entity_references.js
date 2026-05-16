migrate(
  (app) => {
    // Add cross-entity reference fields for tasks, items, and notes.
    // Uses JSON arrays for flexible many-to-many linking between entity types.

    // tasks.linked_item_ids -> JSON array of item IDs (tasks linked to groceries)
    // tasks.linked_note_ids -> JSON array of note IDs (tasks with supporting notes)
    const tasks = app.findCollectionByNameOrId('tasks');
    tasks.fields.add(new Field({
      type: 'json',
      name: 'linked_item_ids',
      required: false,
    }));
    tasks.fields.add(new Field({
      type: 'json',
      name: 'linked_note_ids',
      required: false,
    }));
    app.save(tasks);

    // items.linked_task_ids -> JSON array of task IDs (groceries linked to tasks)
    // items.linked_note_ids -> JSON array of note IDs (items with supporting notes)
    const items = app.findCollectionByNameOrId('items');
    items.fields.add(new Field({
      type: 'json',
      name: 'linked_task_ids',
      required: false,
    }));
    items.fields.add(new Field({
      type: 'json',
      name: 'linked_note_ids',
      required: false,
    }));
    app.save(items);

    // notes.linked_task_ids -> JSON array of task IDs (notes about tasks)
    // notes.linked_item_ids -> JSON array of item IDs (notes about items)
    // notes.project_id -> relation to projects (notes belonging to a project)
    const notes = app.findCollectionByNameOrId('notes');
    notes.fields.add(new Field({
      type: 'json',
      name: 'linked_task_ids',
      required: false,
    }));
    notes.fields.add(new Field({
      type: 'json',
      name: 'linked_item_ids',
      required: false,
    }));
    notes.fields.add(new RelationField({
      name: 'project_id',
      collectionId: app.findCollectionByNameOrId('projects').id,
      cascadeDelete: false,
      maxSelect: 1,
    }));
    app.save(notes);
  },
  (app) => {
    const removeField = (collName, fieldName) => {
      try {
        const coll = app.findCollectionByNameOrId(collName);
        const field = coll.fields.getByName(fieldName);
        if (field) {
          coll.fields.removeById(field.id);
          app.save(coll);
        }
      } catch {}
    };
    removeField('tasks', 'linked_item_ids');
    removeField('tasks', 'linked_note_ids');
    removeField('items', 'linked_task_ids');
    removeField('items', 'linked_note_ids');
    removeField('notes', 'linked_task_ids');
    removeField('notes', 'linked_item_ids');
    removeField('notes', 'project_id');
  },
);
