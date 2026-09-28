migrate(
  (app) => {
    // Create families collection
    let familiesColl;
    try {
      familiesColl = app.findCollectionByNameOrId('families');
    } catch (e) {
      familiesColl = null;
    }
    if (!familiesColl) {
      const familiesCollection = new Collection({
        name: 'families',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: 'created_by = @request.auth.id',
        deleteRule: 'created_by = @request.auth.id',
        fields: [
          { name: 'name', type: 'text', required: true },
          {
            name: 'created_by',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
            required: true,
          },
        ],
      });
      app.save(familiesCollection);
    }

    // Add family_id to users
    const users = app.findCollectionByNameOrId('_pb_users_auth_');
    if (!users.fields.getByName('family_id')) {
      users.fields.add(new Field({
        name: 'family_id',
        type: 'text', // store as plain text id to avoid circular relation issues
        required: false,
      }));
      app.save(users);
    }
  },
  (app) => {
    // Remove family_id from users
    const users = app.findCollectionByNameOrId('_pb_users_auth_');
    const field = users.fields.getByName('family_id');
    if (field) {
      users.fields.remove(field);
      app.save(users);
    }

    // Delete families collection
    try {
      const families = app.findCollectionByNameOrId('families');
      app.delete(families);
    } catch (_) {}
  }
);