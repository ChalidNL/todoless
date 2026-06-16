migrate(
  (app) => {
    const events = app.findCollectionByNameOrId('calendar_events');
    const users = app.findCollectionByNameOrId('users');
    const families = app.findCollectionByNameOrId('families');

    const addField = (field) => {
      if (!events.fields.getByName(field.name)) {
        events.fields.add(new Field(field));
      }
    };

    addField({ name: 'uid', type: 'text', required: false });
    addField({ name: 'location', type: 'text', required: false });
    addField({ name: 'timezone', type: 'text', required: false });
    addField({ name: 'rrule', type: 'text', required: false });
    addField({ name: 'exdates', type: 'json', required: false });
    addField({ name: 'recurrence_id', type: 'text', required: false });
    addField({ name: 'color', type: 'text', required: false });
    addField({ name: 'attendees', type: 'json', required: false });
    addField({ name: 'external_id', type: 'text', required: false });
    addField({ name: 'reminders', type: 'json', required: false });

    if (!events.fields.getByName('source')) {
      events.fields.add(new SelectField({
        name: 'source',
        values: ['local', 'ics_import', 'caldav'],
        maxSelect: 1,
        required: false,
      }));
    }

    if (!events.fields.getByName('owner')) {
      events.fields.add(new RelationField({
        name: 'owner',
        collectionId: users.id,
        cascadeDelete: false,
        maxSelect: 1,
        required: false,
      }));
    }

    if (!events.fields.getByName('family')) {
      events.fields.add(new RelationField({
        name: 'family',
        collectionId: families.id,
        cascadeDelete: true,
        maxSelect: 1,
        required: false,
      }));
    }

    events.listRule = '@request.auth.id != "" && (owner = @request.auth.id || family = @request.auth.family_id || user.family_id = @request.auth.family_id)';
    events.viewRule = events.listRule;
    events.createRule = '@request.auth.id != "" && (family = @request.auth.family_id || family = "")';
    events.updateRule = events.listRule;
    events.deleteRule = events.listRule;
    events.indexes = Array.from(new Set([...(events.indexes || []),
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_uid_family ON calendar_events (uid, family) WHERE uid != ""',
      'CREATE INDEX IF NOT EXISTS idx_calendar_events_family_start ON calendar_events (family, start_time)',
    ]));
    app.save(events);

    const tasks = app.findCollectionByNameOrId('tasks');
    if (!tasks.fields.getByName('show_in_calendar')) {
      tasks.fields.add(new BoolField({ name: 'show_in_calendar', required: false }));
      app.save(tasks);
    }
  },
  (app) => {
    const events = app.findCollectionByNameOrId('calendar_events');
    ['uid', 'location', 'timezone', 'rrule', 'exdates', 'recurrence_id', 'color', 'attendees', 'source', 'external_id', 'owner', 'family', 'reminders'].forEach((name) => {
      try {
        const field = events.fields.getByName(name);
        if (field) events.fields.remove(field.id);
      } catch (_) {}
    });
    app.save(events);

    const tasks = app.findCollectionByNameOrId('tasks');
    try {
      const field = tasks.fields.getByName('show_in_calendar');
      if (field) {
        tasks.fields.remove(field.id);
        app.save(tasks);
      }
    } catch (_) {}
  }
);
