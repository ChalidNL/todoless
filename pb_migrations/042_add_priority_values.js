/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Add medium and high to priority select field in tasks collection
    const tasks = app.findCollectionByNameOrId('tasks');
    const prioField = tasks.fields.getByName('priority');
    if (prioField && prioField.values) {
      if (prioField.values.indexOf('medium') === -1) prioField.values.push('medium');
      if (prioField.values.indexOf('high') === -1) prioField.values.push('high');
      app.save(tasks);
    }

    // Same for items collection
    const items = app.findCollectionByNameOrId('items');
    const itemPrioField = items.fields.getByName('priority');
    if (itemPrioField && itemPrioField.values) {
      if (itemPrioField.values.indexOf('medium') === -1) itemPrioField.values.push('medium');
      if (itemPrioField.values.indexOf('high') === -1) itemPrioField.values.push('high');
      app.save(items);
    }
  },
  (app) => {
    // Rollback: nothing needed, just comment
  }
);
