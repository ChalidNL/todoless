migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('items');

    // Add is_private field to items collection
    if (!collection.fields.getByName('is_private')) {
      collection.fields.add(
        new BoolField({
          name: 'is_private',
        }),
      );
    }

    // Update listRule: owner sees all, family sees non-private
    collection.listRule = 'user = @request.auth.id || (is_private = false && user.family_id = @request.auth.family_id)';

    // Update viewRule: same as listRule
    collection.viewRule = 'user = @request.auth.id || (is_private = false && user.family_id = @request.auth.family_id)';

    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('items');
    collection.listRule = 'user = @request.auth.id';
    collection.viewRule = 'user = @request.auth.id';
    app.save(collection);
  },
);
