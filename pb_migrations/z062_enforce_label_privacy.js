/// <reference path="../pb_data/types.d.ts" />

const TASK_LABEL_ACCESS_RULE = '(label:length = 0 || (label.family:each = @request.auth.family_id && (label.visibility:each = "family" || (label:length = 1 && ((label.visibility = "private" && label.owner = @request.auth.id) || (label.visibility = "shared" && (label.owner = @request.auth.id || label.shared_with.id ?= @request.auth.id)))))))';
const TASK_VISIBILITY_RULE = 'user = @request.auth.id || (is_private = false && user.family_id = @request.auth.family_id && ' + TASK_LABEL_ACCESS_RULE + ')';
const LABEL_FAMILY_RULE = '(family = @request.auth.family_id || user.family_id = @request.auth.family_id)';
const LABEL_VISIBILITY_RULE = 'owner = @request.auth.id || user = @request.auth.id || (' + LABEL_FAMILY_RULE + ' && (visibility = "family" || (visibility = "shared" && shared_with.id ?= @request.auth.id) || (visibility = "private" && owner = @request.auth.id)))';
const PAGE_SIZE = 500;

migrate(
  (app) => {
    const labels = app.findCollectionByNameOrId('labels');
    const tasks = app.findCollectionByNameOrId('tasks');

    labels.listRule = LABEL_VISIBILITY_RULE;
    labels.viewRule = LABEL_VISIBILITY_RULE;
    labels.createRule = '@request.auth.id != "" && (owner = @request.auth.id || (owner = "" && user = @request.auth.id)) && (family = "" || family = @request.auth.family_id)';
    labels.updateRule = 'owner = @request.auth.id || user = @request.auth.id';
    labels.deleteRule = 'owner = @request.auth.id || user = @request.auth.id';
    app.save(labels);

    const taskLabelField = tasks.fields.getByName('label');
    if (!taskLabelField) {
      tasks.fields.add(new RelationField({ name: 'label', collectionId: labels.id, cascadeDelete: false, maxSelect: 99, required: false }));
    } else {
      taskLabelField.maxSelect = 99;
    }
    app.save(tasks);

    let offset = 0;
    while (true) {
      const batch = app.findRecordsByFilter('tasks', '', 'id', PAGE_SIZE, offset);
      if (batch.length === 0) break;

      for (const task of batch) {
        const current = task.get('label');
        const currentLabels = Array.isArray(current) ? current.filter(Boolean) : (current ? [String(current)] : []);
        const legacy = task.get('labels') || [];
        const legacyLabels = Array.isArray(legacy) ? legacy : (legacy ? [legacy] : []);
        const canonicalLabels = currentLabels.slice();
        let unresolved = false;

        for (const legacyLabel of legacyLabels) {
          const candidate = String(legacyLabel || '').trim();
          if (!candidate || canonicalLabels.indexOf(candidate) !== -1) continue;
          try {
            app.findRecordById('labels', candidate);
            canonicalLabels.push(candidate);
          } catch (_) {
            unresolved = true;
          }
        }

        let changed = false;
        if (canonicalLabels.length > 0 && JSON.stringify(currentLabels) !== JSON.stringify(canonicalLabels)) {
          task.set('label', canonicalLabels);
          changed = true;
        }
        if (unresolved && task.get('is_private') !== true) {
          task.set('is_private', true);
          changed = true;
        }
        if (changed) app.save(task);
      }

      offset += batch.length;
      if (batch.length < PAGE_SIZE) break;
    }

    tasks.listRule = TASK_VISIBILITY_RULE;
    tasks.viewRule = TASK_VISIBILITY_RULE;
    tasks.createRule = '@request.auth.id != "" && user = @request.auth.id && ' + TASK_LABEL_ACCESS_RULE;
    tasks.updateRule = 'user = @request.auth.id && ' + TASK_LABEL_ACCESS_RULE;
    tasks.deleteRule = 'user = @request.auth.id';
    app.save(tasks);
  },
  (app) => {
    // Security hardening is intentionally schema-preserving on rollback. Legacy
    // clients remain compatible because all writers continue to dual-write labels.
    const labels = app.findCollectionByNameOrId('labels');
    const tasks = app.findCollectionByNameOrId('tasks');
    labels.listRule = LABEL_VISIBILITY_RULE;
    labels.viewRule = LABEL_VISIBILITY_RULE;
    tasks.listRule = TASK_VISIBILITY_RULE;
    tasks.viewRule = TASK_VISIBILITY_RULE;
    app.save(labels);
    app.save(tasks);
  }
);
