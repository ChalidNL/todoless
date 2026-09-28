migrate(
  (app) => {
    for (const collectionName of ['tasks', 'notes']) {
      const collection = app.findCollectionByNameOrId(collectionName);
      const field = collection.fields.getByName('repeat_interval');
      if (!field) continue;
      field.values = ['day', 'week', 'month', 'year', 'month_weekday'];
      field.maxSelect = 1;
      app.save(collection);
    }
  },
  (app) => {
    for (const collectionName of ['tasks', 'notes']) {
      const collection = app.findCollectionByNameOrId(collectionName);
      const records = $app.findRecordsByFilter(collectionName, 'repeat_interval != ""', '', 100000, 0);
      for (const record of records) {
        const repeatInterval = String(record.get('repeat_interval') || '');
        if (repeatInterval === 'day') {
          record.set('repeat_interval', '');
          app.save(record);
        } else if (repeatInterval === 'month_weekday') {
          record.set('repeat_interval', '');
          app.save(record);
        }
      }
      const field = collection.fields.getByName('repeat_interval');
      if (!field) continue;
      field.values = ['week', 'month', 'year'];
      field.maxSelect = 1;
      app.save(collection);
    }
  },
);