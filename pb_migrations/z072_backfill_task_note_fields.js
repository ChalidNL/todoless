/// <reference path="../pb_data/types.d.ts" />

// #224: a task's note lived in two fields — `blocked_comment` (shown/edited in
// the app, exposed as `description` by /api/v1) and `description` (ICS
// import/export). The tasks record hooks now keep them identical
// (pb_hooks/lib/task-note.js); this fills the empty side of existing records
// so the app, the API and the calendar export agree from the start.
//
// Raw SQL so no record hooks or realtime events fire. Records where both
// fields are set (even to different text) are left alone. Idempotent (GH#34):
// a second run matches nothing. The down migration is a no-op — the copied
// text cannot be told apart from text that was there before.
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
    if (!hasField(tasks, 'description') || !hasField(tasks, 'blocked_comment')) return;
    app.db().newQuery(`
      UPDATE tasks SET description = blocked_comment
      WHERE COALESCE(description, '') = '' AND COALESCE(blocked_comment, '') <> ''
    `).execute();
    app.db().newQuery(`
      UPDATE tasks SET blocked_comment = description
      WHERE COALESCE(blocked_comment, '') = '' AND COALESCE(description, '') <> ''
    `).execute();
  },
  () => {}
);
