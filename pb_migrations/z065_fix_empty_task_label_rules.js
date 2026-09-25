/// <reference path="../pb_data/types.d.ts" />

// Multi-relation fields are represented as arrays during create/update rule
// evaluation. Comparing an empty relation to "" rejects valid unlabeled task
// writes. Use the relation length so both reads and writes handle emptiness.
const TASK_LABEL_ACCESS_RULE = '(label:length = 0 || (label.family:each = @request.auth.family_id && (label.visibility:each = "family" || (label:length = 1 && ((label.visibility = "private" && label.owner = @request.auth.id) || (label.visibility = "shared" && (label.owner = @request.auth.id || label.shared_with.id ?= @request.auth.id)))))))';
const TASK_VISIBILITY_RULE = 'user = @request.auth.id || (is_private = false && user.family_id = @request.auth.family_id && ' + TASK_LABEL_ACCESS_RULE + ')';

migrate(
  function(app) {
    var tasks = app.findCollectionByNameOrId('tasks');
    tasks.listRule = TASK_VISIBILITY_RULE;
    tasks.viewRule = TASK_VISIBILITY_RULE;
    tasks.createRule = '@request.auth.id != "" && user = @request.auth.id && ' + TASK_LABEL_ACCESS_RULE;
    tasks.updateRule = 'user = @request.auth.id && ' + TASK_LABEL_ACCESS_RULE;
    app.save(tasks);
  },
  function(app) {
    // Keep the secure length-based rules on rollback. Reintroducing the old
    // empty-string comparison would break ordinary task writes again.
    var tasks = app.findCollectionByNameOrId('tasks');
    tasks.listRule = TASK_VISIBILITY_RULE;
    tasks.viewRule = TASK_VISIBILITY_RULE;
    tasks.createRule = '@request.auth.id != "" && user = @request.auth.id && ' + TASK_LABEL_ACCESS_RULE;
    tasks.updateRule = 'user = @request.auth.id && ' + TASK_LABEL_ACCESS_RULE;
    app.save(tasks);
  }
);
