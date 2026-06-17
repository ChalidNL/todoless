migrate(
  (app) => {
    const tasks = app.findCollectionByNameOrId('tasks');

    if (!tasks.fields.getByName('start_time')) {
      tasks.fields.add(new DateField({ name: 'start_time', required: false }));
    }
    if (!tasks.fields.getByName('end_time')) {
      tasks.fields.add(new DateField({ name: 'end_time', required: false }));
    }
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
        if (field) tasks.fields.remove(field);
      } catch (_) {}
    });

    app.save(tasks);
  }
);
