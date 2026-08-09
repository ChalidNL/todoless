/// <reference path="../pb_data/types.d.ts" />

// PocketBase relation rules must compare the related record id for multi-select
// relation membership. Comparing the relation field directly silently excludes
// explicitly shared users from list/view results.
const TASK_LABEL_ACCESS_RULE = '(label = "" || (label.family:each = @request.auth.family_id && (label.visibility:each = "family" || (label:length = 1 && ((label.visibility = "private" && label.owner = @request.auth.id) || (label.visibility = "shared" && (label.owner = @request.auth.id || label.shared_with.id ?= @request.auth.id)))))))';
const TASK_VISIBILITY_RULE = 'user = @request.auth.id || (is_private = false && user.family_id = @request.auth.family_id && ' + TASK_LABEL_ACCESS_RULE + ')';
const LABEL_FAMILY_RULE = '(family = @request.auth.family_id || user.family_id = @request.auth.family_id)';
const LABEL_VISIBILITY_RULE = 'owner = @request.auth.id || user = @request.auth.id || (' + LABEL_FAMILY_RULE + ' && (visibility = "family" || (visibility = "shared" && shared_with.id ?= @request.auth.id) || (visibility = "private" && owner = @request.auth.id)))';

const PREVIOUS_TASK_LABEL_ACCESS_RULE = '(label = "" || (label.family:each = @request.auth.family_id && (label.visibility:each = "family" || (label:length = 1 && ((label.visibility = "private" && label.owner = @request.auth.id) || (label.visibility = "shared" && (label.owner = @request.auth.id || label.shared_with ?= @request.auth.id)))))))';
const PREVIOUS_TASK_VISIBILITY_RULE = 'user = @request.auth.id || (is_private = false && user.family_id = @request.auth.family_id && ' + PREVIOUS_TASK_LABEL_ACCESS_RULE + ')';
const PREVIOUS_LABEL_VISIBILITY_RULE = 'owner = @request.auth.id || user = @request.auth.id || (' + LABEL_FAMILY_RULE + ' && (visibility = "family" || (visibility = "shared" && shared_with ?= @request.auth.id) || (visibility = "private" && owner = @request.auth.id)))';

migrate(
  function(app) {
    var labels = app.findCollectionByNameOrId('labels');
    var tasks = app.findCollectionByNameOrId('tasks');

    labels.listRule = LABEL_VISIBILITY_RULE;
    labels.viewRule = LABEL_VISIBILITY_RULE;
    app.save(labels);

    tasks.listRule = TASK_VISIBILITY_RULE;
    tasks.viewRule = TASK_VISIBILITY_RULE;
    tasks.createRule = '@request.auth.id != "" && user = @request.auth.id && ' + TASK_LABEL_ACCESS_RULE;
    tasks.updateRule = 'user = @request.auth.id && ' + TASK_LABEL_ACCESS_RULE;
    app.save(tasks);
  },
  function(app) {
    var labels = app.findCollectionByNameOrId('labels');
    var tasks = app.findCollectionByNameOrId('tasks');

    labels.listRule = PREVIOUS_LABEL_VISIBILITY_RULE;
    labels.viewRule = PREVIOUS_LABEL_VISIBILITY_RULE;
    app.save(labels);

    tasks.listRule = PREVIOUS_TASK_VISIBILITY_RULE;
    tasks.viewRule = PREVIOUS_TASK_VISIBILITY_RULE;
    tasks.createRule = '@request.auth.id != "" && user = @request.auth.id && ' + PREVIOUS_TASK_LABEL_ACCESS_RULE;
    tasks.updateRule = 'user = @request.auth.id && ' + PREVIOUS_TASK_LABEL_ACCESS_RULE;
    app.save(tasks);
  },
);
