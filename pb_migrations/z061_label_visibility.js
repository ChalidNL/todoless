/// <reference path="../pb_data/types.d.ts" />

// Unlabeled tasks are family-visible to preserve TodoLess' current shared-family behavior.
const TASK_VISIBILITY_RULE = 'user.family_id = @request.auth.family_id && (label = "" || label.visibility = "family" || (label.visibility = "private" && label.owner = @request.auth.id) || (label.visibility = "shared" && (label.owner = @request.auth.id || label.shared_with ?= @request.auth.id)))';
const LABEL_VISIBILITY_RULE = 'family = @request.auth.family_id || user.family_id = @request.auth.family_id || owner = @request.auth.id';

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const families = app.findCollectionByNameOrId('families');
    const labels = app.findCollectionByNameOrId('labels');
    const tasks = app.findCollectionByNameOrId('tasks');

    if (!labels.fields.getByName('visibility')) {
      labels.fields.add(new SelectField({ name: 'visibility', values: ['private', 'shared', 'family'], maxSelect: 1, required: true }));
    }
    if (!labels.fields.getByName('owner')) {
      labels.fields.add(new RelationField({ name: 'owner', collectionId: users.id, cascadeDelete: false, maxSelect: 1, required: false }));
    }
    if (!labels.fields.getByName('shared_with')) {
      labels.fields.add(new RelationField({ name: 'shared_with', collectionId: users.id, cascadeDelete: false, maxSelect: 99, required: false }));
    }
    if (!labels.fields.getByName('family')) {
      labels.fields.add(new RelationField({ name: 'family', collectionId: families.id, cascadeDelete: false, maxSelect: 1, required: false }));
    }
    app.save(labels);

    const existingLabels = app.findRecordsByFilter('labels', '', '', 10000, 0);
    for (const label of existingLabels) {
      const owner = String(label.get('owner') || label.get('user') || '');
      if (!label.get('owner') && owner) label.set('owner', owner);
      if (!label.get('visibility')) label.set('visibility', label.get('is_private') ? 'private' : 'family');
      if (!label.get('family') && owner) {
        try {
          const ownerRecord = app.findRecordById('users', owner);
          label.set('family', String(ownerRecord.get('family_id') || ''));
        } catch (_) {}
      }
      app.save(label);
    }

    labels.listRule = LABEL_VISIBILITY_RULE;
    labels.viewRule = LABEL_VISIBILITY_RULE;
    labels.createRule = '@request.auth.id != "" && (family = @request.auth.family_id || family = "" || owner = @request.auth.id || owner = "")';
    labels.updateRule = 'owner = @request.auth.id || user = @request.auth.id';
    labels.deleteRule = 'owner = @request.auth.id || user = @request.auth.id';
    app.save(labels);

    if (!tasks.fields.getByName('label')) {
      tasks.fields.add(new RelationField({ name: 'label', collectionId: labels.id, cascadeDelete: false, maxSelect: 1, required: false }));
      app.save(tasks);
    }

    const existingTasks = app.findRecordsByFilter('tasks', '', '', 10000, 0);
    for (const task of existingTasks) {
      if (task.get('label')) continue;
      const legacyLabels = task.get('labels') || [];
      if (legacyLabels && legacyLabels.length > 0) {
        const candidate = String(legacyLabels[0] || '');
        if (!candidate) continue;
        try {
          app.findRecordById('labels', candidate);
          task.set('label', candidate);
          app.save(task);
        } catch (_) {
          // Older tasks may contain free-text label names or stale ids in the legacy JSON array.
          // Leave those tasks unlabeled; unlabeled tasks are intentionally family-visible.
        }
      }
    }

    tasks.listRule = TASK_VISIBILITY_RULE;
    tasks.viewRule = TASK_VISIBILITY_RULE;
    tasks.createRule = '@request.auth.id != "" && user.family_id = @request.auth.family_id && (label = "" || label.family = @request.auth.family_id || label.owner = @request.auth.id || label.shared_with ?= @request.auth.id)';
    tasks.updateRule = TASK_VISIBILITY_RULE + ' && (label = "" || label.family = @request.auth.family_id || label.owner = @request.auth.id || label.shared_with ?= @request.auth.id)';
    tasks.deleteRule = TASK_VISIBILITY_RULE;
    app.save(tasks);
  },
  (app) => {
    const labels = app.findCollectionByNameOrId('labels');
    const tasks = app.findCollectionByNameOrId('tasks');

    ['visibility', 'owner', 'shared_with', 'family'].forEach((name) => {
      try {
        const field = labels.fields.getByName(name);
        if (field) labels.fields.remove(field.id || field);
      } catch (_) {}
    });
    labels.listRule = 'user = @request.auth.id || user.family_id = @request.auth.family_id';
    labels.viewRule = labels.listRule;
    labels.createRule = '@request.auth.id != ""';
    labels.updateRule = 'user = @request.auth.id';
    labels.deleteRule = 'user = @request.auth.id';
    app.save(labels);

    try {
      const field = tasks.fields.getByName('label');
      if (field) tasks.fields.remove(field.id || field);
    } catch (_) {}
    tasks.listRule = 'user = @request.auth.id || (is_private = false && user.family_id = @request.auth.family_id)';
    tasks.viewRule = tasks.listRule;
    tasks.createRule = '@request.auth.id != ""';
    tasks.updateRule = 'user = @request.auth.id';
    tasks.deleteRule = 'user = @request.auth.id';
    app.save(tasks);
  }
);
