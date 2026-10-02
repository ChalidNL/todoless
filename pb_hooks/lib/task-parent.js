// #241: one level of subtasks, enforced on the server. A task's parent
// (linked_to with linked_type 'task') must be another, existing, top-level
// task -- never the task itself and never a subtask. A top-level parent can
// never be a descendant of the child, so this also rules out every cycle
// (A -> B -> A, or deeper), whichever route writes the link.
//
// Pure apart from the record lookup, so it can be unit-tested
// (tests/task-parent.test.mjs).

function str(v) { return v === undefined || v === null ? '' : String(v); }

// Is `rec` linked to another TASK? linked_type 'task' says so explicitly;
// an empty linked_type with a linked_to that resolves to a task is the same
// thing (older writers, and /api/v1 create before the linked_type default,
// left the type empty). 'item'/'note' links are not subtask links.
function taskParentId(rec, findTask) {
  var type = str(rec.get('linked_type'));
  var parentId = str(rec.get('linked_to')).trim();
  if (!parentId) return '';
  if (type === 'task') return parentId;
  if (type === '' && parentId !== str(rec.id) && findTask(parentId)) return parentId;
  return '';
}

/** '' when the parent link of `rec` is acceptable, else an error message. */
function parentLinkError(rec, findTask) {
  var type = str(rec.get('linked_type'));
  if (type !== 'task' && type !== '') return '';
  var parentId = str(rec.get('linked_to')).trim();
  if (!parentId) return '';
  if (parentId === str(rec.id)) return 'A task cannot be its own subtask';
  var parent = findTask(parentId);
  if (!parent) return type === 'task' ? 'Parent task not found' : '';
  if (taskParentId(parent, findTask)) {
    return 'A subtask cannot have subtasks of its own';
  }
  return '';
}

module.exports = { parentLinkError: parentLinkError, taskParentId: taskParentId };
