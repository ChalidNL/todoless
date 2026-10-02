/// <reference path="../pb_data/types.d.ts" />

// POST /api/v1 create stored a child created with linked_to (documented as
// the parent task id) without linked_type. The app derives subtasks from
// linked_type = 'task' (GH#88), so those children showed up as ordinary
// top-level tasks, and the server-side cycle guard (#241) treated them as
// top-level too. The route now defaults linked_type to 'task'; this fills
// the field for rows that already exist and whose linked_to is a task.
//
// Raw SQL like z072: no record hooks, no realtime events. Idempotent. Down
// is a no-op (an explicit 'task' cannot be told apart from a backfilled one).
function hasField(collection, name) {
  return !!collection.fields.getByName(name);
}

migrate(
  (app) => {
    let tasks;
    try {
      tasks = app.findCollectionByNameOrId('tasks');
    } catch (_) {
      return;
    }
    if (!hasField(tasks, 'linked_to') || !hasField(tasks, 'linked_type')) return;
    app.db().newQuery(`
      UPDATE tasks SET linked_type = 'task'
      WHERE COALESCE(linked_type, '') = ''
        AND COALESCE(linked_to, '') <> ''
        AND linked_to <> id
        AND linked_to IN (SELECT id FROM tasks)
    `).execute();
  },
  () => {}
);
