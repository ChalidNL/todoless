migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('tasks');

    // Owners see all their tasks. Family members see non-private tasks from the same family.
    // Mutating remains owner-only; broader family editing is handled by a separate policy task.
    collection.listRule = 'user = @request.auth.id || (is_private = false && user.family_id = @request.auth.family_id)';
    collection.viewRule = 'user = @request.auth.id || (is_private = false && user.family_id = @request.auth.family_id)';
    collection.createRule = '@request.auth.id != ""';
    collection.updateRule = 'user = @request.auth.id';
    collection.deleteRule = 'user = @request.auth.id';

    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('tasks');

    collection.listRule = 'user = @request.auth.id';
    collection.viewRule = 'user = @request.auth.id';
    collection.createRule = '@request.auth.id != ""';
    collection.updateRule = 'user = @request.auth.id';
    collection.deleteRule = 'user = @request.auth.id';

    app.save(collection);
  },
);
