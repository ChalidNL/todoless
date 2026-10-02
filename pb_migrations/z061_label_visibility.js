/// <reference path="../pb_data/types.d.ts" />

// Unlabeled, non-private tasks remain family-visible. Multi-label tasks are only
// family-visible when every label is family-visible; shared/private labels are
// deliberately restricted to one canonical relation because PB rules cannot
// correlate per-user access across multiple related records safely.
const TASK_LABEL_ACCESS_RULE = '(label:length = 0 || (label.family:each = @request.auth.family_id && (label.visibility:each = "family" || (label:length = 1 && ((label.visibility = "private" && label.owner = @request.auth.id) || (label.visibility = "shared" && (label.owner = @request.auth.id || label.shared_with.id ?= @request.auth.id)))))))';
const TASK_VISIBILITY_RULE = 'user = @request.auth.id || (is_private = false && user.family_id = @request.auth.family_id && ' + TASK_LABEL_ACCESS_RULE + ')';
const LABEL_FAMILY_RULE = '(family = @request.auth.family_id || user.family_id = @request.auth.family_id)';
const LABEL_VISIBILITY_RULE = 'owner = @request.auth.id || user = @request.auth.id || (' + LABEL_FAMILY_RULE + ' && (visibility = "family" || (visibility = "shared" && shared_with.id ?= @request.auth.id) || (visibility = "private" && owner = @request.auth.id)))';

// Reading the legacy `labels` JSON field inside the JSVM: record.get() hands
// back the raw JSON bytes (types.JSONRaw), which Goja exposes as an array of
// char codes -- Array.isArray() is true, but the elements are numbers, so no
// element ever resolves to a label id. The JSON text comes from getString().
// (Same pitfall as pb_hooks/lib/json-field.js; kept inline because migrations
// cannot require hook libraries.)
function readLegacyLabels(record) {
  let raw = '';
  try { raw = record.getString('labels'); } catch (_) { raw = ''; }
  raw = String(raw === null || raw === undefined ? '' : raw).trim();
  if (!raw || raw === 'null') return [];
  let parsed;
  try { parsed = JSON.parse(raw); } catch (_) { return []; }
  if (Array.isArray(parsed)) return parsed;
  return parsed === null || parsed === '' ? [] : [parsed];
}

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

    const existingTasks = app.findRecordsByFilter('tasks', '', '', 10000, 0);
    for (const task of existingTasks) {
      // get('label') on a multi-relation returns [] (truthy) when empty.
      const current = task.get('label');
      const currentLabels = Array.isArray(current) ? current.filter(Boolean) : (current ? [String(current)] : []);
      if (currentLabels.length > 0) continue;
      const legacyLabels = readLegacyLabels(task);
      if (legacyLabels.length > 0) {
        const canonicalLabels = [];
        for (const legacyLabel of legacyLabels) {
          const candidate = String(legacyLabel || '');
          if (!candidate) continue;
          try {
            app.findRecordById('labels', candidate);
            canonicalLabels.push(candidate);
          } catch (_) {
            // Ignore free-text labels and stale relation ids without discarding valid ids.
          }
        }
        if (canonicalLabels.length > 0) {
          task.set('label', canonicalLabels);
          app.save(task);
        }
      }
    }

    tasks.listRule = TASK_VISIBILITY_RULE;
    tasks.viewRule = TASK_VISIBILITY_RULE;
    tasks.createRule = '@request.auth.id != "" && user = @request.auth.id && ' + TASK_LABEL_ACCESS_RULE;
    tasks.updateRule = 'user = @request.auth.id && ' + TASK_LABEL_ACCESS_RULE;
    tasks.deleteRule = 'user = @request.auth.id';
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
