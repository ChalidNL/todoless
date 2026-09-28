migrate(
  (app) => {
    // Add cross-collection relations that couldn't be set during creation

    // tasks.sprint_id -> sprints
    const tasks = app.findCollectionByNameOrId('tasks');
    if (!tasks.fields.getByName('sprint_id')) {
      tasks.fields.add(new RelationField({
        name: 'sprint_id',
        collectionId: app.findCollectionByNameOrId('sprints').id,
        cascadeDelete: false,
        maxSelect: 1,
      }));
      app.save(tasks);
    }

    // items.shop_id -> shops
    const items = app.findCollectionByNameOrId('items');
    if (!items.fields.getByName('shop_id')) {
      items.fields.add(new RelationField({
        name: 'shop_id',
        collectionId: app.findCollectionByNameOrId('shops').id,
        cascadeDelete: false,
        maxSelect: 1,
      }));
      app.save(items);
    }

    // calendar_events.task_id -> tasks
    const calEvents = app.findCollectionByNameOrId('calendar_events');
    if (!calEvents.fields.getByName('task_id')) {
      calEvents.fields.add(new RelationField({
        name: 'task_id',
        collectionId: tasks.id,
        cascadeDelete: false,
        maxSelect: 1,
      }));
      app.save(calEvents);
    }

    // invite_codes.used_by -> users
    const inviteCodes = app.findCollectionByNameOrId('invite_codes');
    if (!inviteCodes.fields.getByName('used_by')) {
      inviteCodes.fields.add(new RelationField({
        name: 'used_by',
        collectionId: '_pb_users_auth_',
        cascadeDelete: false,
        maxSelect: 1,
      }));
      app.save(inviteCodes);
    }
  },
  (app) => {
    // Remove cross-collection relation fields
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
    removeField('tasks', 'sprint_id');
    removeField('items', 'shop_id');
    removeField('calendar_events', 'task_id');
    removeField('invite_codes', 'used_by');
  },
);