// #241: one level of subtasks, enforced on the server. A task's parent
// (linked_to with linked_type 'task') must be another, existing, top-level
// task -- never the task itself and never a subtask. A top-level parent can
// never be a descendant of the child, so this also rules out every cycle
// (A -> B -> A, or deeper), whichever route writes the link.
//
// Pure apart from the record lookup, so it can be unit-tested
// (tests/task-parent.test.mjs).

function str(v) { return v === undefined || v === null ? '' : String(v); }

/** '' when the parent link of `rec` is acceptable, else an error message. */
function parentLinkError(rec, findTask) {
  if (str(rec.get('linked_type')) !== 'task') return '';
  var parentId = str(rec.get('linked_to')).trim();
  if (!parentId) return '';
  if (parentId === str(rec.id)) return 'A task cannot be its own subtask';
  var parent = findTask(parentId);
  if (!parent) return 'Parent task not found';
  if (str(parent.get('linked_type')) === 'task' && str(parent.get('linked_to')).trim()) {
    return 'A subtask cannot have subtasks of its own';
  }
  return '';
}

module.exports = { parentLinkError: parentLinkError };
