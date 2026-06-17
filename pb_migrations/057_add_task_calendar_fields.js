migrate(
  (app) => {
    const tasks = app.findCollectionByNameOrId('tasks');

    const addField = (field) => {
      if (!tasks.fields.getByName(field.name)) {
        tasks.fields.add(new Field(field));
      }
    };

    addField({ name: 'start_time', type: 'date', required: false });
    addField({ name: 'end_time', type: 'date', required: false });

    if (!tasks.fields.getByName('all_day')) {
      tasks.fields.add(new BoolField({ name: 'all_day', required: false }));
    }

    app.save(tasks);
  },
  (app) => {
    const tasks = app.findCollectionByNameOrId('tasks');

    ['start_time', 'end_time', 'all_day'].forEach((name) => {
      try {
        const field = tasks.fields.getByName(name);
        if (field) tasks.fields.remove(field.id);
      } catch (_) {}
    });

    app.save(tasks);
  }
);
