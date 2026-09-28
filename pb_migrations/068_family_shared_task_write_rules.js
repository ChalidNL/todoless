/// <reference path="../pb_data/types.d.ts" />

// Public family tasks are collaborative: every authenticated member of the
// owner's family may edit or delete them. Private tasks remain owner-only.
// Label visibility remains part of the write rule so a member cannot mutate a
// task carrying a label they are not allowed to access.
const TASK_LABEL_ACCESS_RULE = '(label:length = 0 || (label.family:each = @request.auth.family_id && (label.visibility:each = "family" || (label:length = 1 && ((label.visibility = "private" && label.owner = @request.auth.id) || (label.visibility = "shared" && (label.owner = @request.auth.id || label.shared_with.id ?= @request.auth.id)))))))';
const TASK_FAMILY_WRITE_RULE = '@request.auth.id != "" && (user = @request.auth.id || (is_private = false && user.family_id = @request.auth.family_id)) && ' + TASK_LABEL_ACCESS_RULE;
const PREVIOUS_TASK_UPDATE_RULE = 'user = @request.auth.id && ' + TASK_LABEL_ACCESS_RULE;
const PREVIOUS_TASK_DELETE_RULE = 'user = @request.auth.id';

migrate(
  function(app) {
    var tasks = app.findCollectionByNameOrId('tasks');
    tasks.updateRule = TASK_FAMILY_WRITE_RULE;
    tasks.deleteRule = TASK_FAMILY_WRITE_RULE;
    app.save(tasks);
  },
  function(app) {
    var tasks = app.findCollectionByNameOrId('tasks');
    tasks.updateRule = PREVIOUS_TASK_UPDATE_RULE;
    tasks.deleteRule = PREVIOUS_TASK_DELETE_RULE;
    app.save(tasks);
  }
);
