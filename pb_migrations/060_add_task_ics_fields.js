migrate(
  (app) => {
    const tasks = app.findCollectionByNameOrId('tasks');

    // Text fields
    const textFields = ['description', 'location', 'uid', 'timezone', 'rrule'];
    for (const name of textFields) {
      if (!tasks.fields.getByName(name)) {
        tasks.fields.add(new Field({ name, type: 'text', required: false }));
      }
    }

    // JSON fields
    if (!tasks.fields.getByName('exdates')) {
      tasks.fields.add(new Field({ name: 'exdates', type: 'json', required: false }));
    }

    // recurrence_id (text, for detached recurrence instances)
    if (!tasks.fields.getByName('recurrence_id')) {
      tasks.fields.add(new Field({ name: 'recurrence_id', type: 'text', required: false }));
    }

    // source (select: local or ics_import)
    if (!tasks.fields.getByName('source')) {
      tasks.fields.add(new SelectField({
        name: 'source',
        values: ['local', 'ics_import'],
        maxSelect: 1,
        required: false,
      }));
    }

    // external_id (text, original UID from external calendar)
    if (!tasks.fields.getByName('external_id')) {
      tasks.fields.add(new Field({ name: 'external_id', type: 'text', required: false }));
    }

    // Unique index on (family_id, uid) — requires family_id field
    // Use user.family_id relation for uniqueness check in application logic
    // since tasks collection does not have a direct family_id column.
    // Add index on uid for fast lookup
    tasks.indexes = Array.from(new Set([...(tasks.indexes || []),
      'CREATE INDEX IF NOT EXISTS idx_tasks_uid ON tasks (uid) WHERE uid != ""',
    ]));

    app.save(tasks);
  },
  (app) => {
    const tasks = app.findCollectionByNameOrId('tasks');
    const fieldsToRemove = ['description', 'location', 'uid', 'timezone', 'rrule',
      'exdates', 'recurrence_id', 'source', 'external_id'];
    for (const name of fieldsToRemove) {
      try {
        const field = tasks.fields.getByName(name);
        if (field) tasks.fields.remove(field.id);
      } catch (_) {}
    }
    // Remove index
    tasks.indexes = (tasks.indexes || []).filter(
      (idx) => !String(idx).includes('idx_tasks_uid')
    );
    app.save(tasks);
  }
);
