migrate(
  (app) => {
    // Create projects collection
    let projectsColl;
    try {
      projectsColl = app.findCollectionByNameOrId('projects');
    } catch (e) {
      projectsColl = null;
    }
    if (!projectsColl) {
      app.save(
        new Collection({
          name: 'projects',
          type: 'base',
          listRule: 'user = @request.auth.id',
          viewRule: 'user = @request.auth.id',
          createRule: '@request.auth.id != ""',
          updateRule: 'user = @request.auth.id',
          deleteRule: 'user = @request.auth.id',
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'description', type: 'text' },
            { name: 'color', type: 'text', required: true },
            { name: 'status', type: 'select', required: true, values: ['active', 'completed', 'archived'], maxSelect: 1 },
            { name: 'task_ids', type: 'json' },
            { name: 'due_date', type: 'date' },
            { name: 'user', type: 'relation', required: true, collectionId: '_pb_users_auth_', cascadeDelete: true, maxSelect: 1 },
          ],
        }),
      );
    }

    // Add project_id relation to tasks if it doesn't exist yet
    const tasks = app.findCollectionByNameOrId('tasks');
    const existingProjectId = tasks.fields.getByName('project_id');
    if (!existingProjectId) {
      tasks.fields.add(
        new RelationField({
          name: 'project_id',
          collectionId: app.findCollectionByNameOrId('projects').id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      );
      app.save(tasks);
    }
  },
  (app) => {
    try {
      const tasks = app.findCollectionByNameOrId('tasks');
      const projectIdField = tasks.fields.getByName('project_id');
      if (projectIdField) {
        tasks.fields.remove(projectIdField.id);
        app.save(tasks);
      }
    } catch {}
    try {
      app.delete(app.findCollectionByNameOrId('projects'));
    } catch {}
  },
);
