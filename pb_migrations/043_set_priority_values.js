/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Set priority values to only low, medium, high — remove urgent and normal
    // Default: medium

    const updatePriority = (collName) => {
      const coll = app.findCollectionByNameOrId(collName);
      const prioField = coll.fields.getByName('priority');
      if (prioField) {
        // Set exact values
        prioField.values = ['low', 'medium', 'high'];
        app.save(coll);
      }
    };

    updatePriority('tasks');
    updatePriority('items');
  },
  (app) => {
    // Rollback: restore original values
    const restore = (collName) => {
      const coll = app.findCollectionByNameOrId(collName);
      const prioField = coll.fields.getByName('priority');
      if (prioField) {
        prioField.values = ['urgent', 'normal', 'low', 'medium', 'high'];
        app.save(coll);
      }
    };
    restore('tasks');
    restore('items');
  }
);
