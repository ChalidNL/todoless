// pb_hooks/lib/task-status.js
// The one task status vocabulary. tasks.status is a select with exactly
// these values; 'in_progress' is accepted as an alias of 'todo' on every
// write and filter path (the agents API documented it first, /api/v1
// followed in #225). Before this file each route kept its own list and
// they had drifted: /api/agent/tasks rejected 'backlog' and accepted
// 'cancelled' (which never matches anything), the agent dispatch silently
// turned any unknown status into 'todo' on create and wrote it unvalidated
// on update (#232).
//
// Pure JS, no PocketBase globals - unit-tested by tests/task-status.test.mjs.

var TASK_STATUSES = ['backlog', 'todo', 'done'];

// Trimmed input with the alias applied; '' when nothing was given.
function normalizeTaskStatus(value) {
  var st = String(value === null || value === undefined ? '' : value).trim();
  return st === 'in_progress' ? 'todo' : st;
}

function isTaskStatus(value) {
  return TASK_STATUSES.indexOf(value) !== -1;
}

module.exports = { TASK_STATUSES: TASK_STATUSES, normalizeTaskStatus: normalizeTaskStatus, isTaskStatus: isTaskStatus };
