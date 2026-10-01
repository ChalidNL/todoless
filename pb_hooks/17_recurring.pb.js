// pb_hooks/17_recurring.pb.js
// GH#7 — recurring tasks: completing a task with repeat_interval must create
// the next occurrence immediately.
//
// History: the legacy pb_hooks/cron/recurring-tasks.js lived in a subdirectory
// without a .pb.js suffix, so PocketBase never loaded it (and it used the
// pre-0.23 DAO/upsert action APIs that do not exist anymore).
// Instead of an hourly cron this hook reacts to the status transition into
// 'done' on the record update event, which fires for every persist path
// (native collection API, /api/v1, /api/tasks, agent routes), so recurrence
// works for the UI and all API clients with zero polling delay.
//
// PB 0.40 JSVM notes (all verified empirically against 0.40.4):
// - canonical record hooks take (handler, optCollectionName...) — a
//   (collectionName, handler) call silently registers NOTHING;
// - record hooks fire for every persist path, including $app.save() from
//   other hooks — no client-side fallback is needed;
// - e.record.original() returns the pre-update snapshot; used to only react
//   to the transition INTO done (editing a done task must not spawn
//   duplicate occurrences);
// - the pure date math lives in pb_hooks/lib/recurrence.js (unit-tested by
//   node --test tests/recurrence.test.mjs).

// Scoped to the tasks collection: without the tag the callback would run for
// every update of every collection (users, items, _logs mirrors, ...).
onRecordAfterUpdateSuccess((e) => {
  // The hook must NEVER break the completion request: every unexpected error
  // is logged and swallowed so the user's action always succeeds.
  try {
    // PocketBase's Goja runtime does not reliably expose top-level `var` values
    // inside route/hook callbacks, so require shared libs inside the callback
    // (same pattern as the existing route hooks).
    var recurrenceLib = require(__hooks + '/lib/recurrence.js');
    var dateSync = require(__hooks + '/lib/task-date-sync.js');
    var rec = e.record;

    var repeatInterval = rec.get('repeat_interval');
    if (!repeatInterval) return;

    // Only react to the transition INTO done on a non-archived task.
    if (String(rec.get('status') || '') !== 'done') return;
    if (rec.get('archived') === true) return;

    // Pre-update snapshot: skip when the task was already done before this
    // update (e.g. the user edits the comment of a completed recurring task —
    // that must not create a second occurrence).
    var original = null;
    try { original = rec.original(); } catch (_errOriginal) { original = null; }
    if (original) {
      try {
        if (String(original.get('status') || '') === 'done') return;
      } catch (_errOriginalRead) { /* ignore */ }
    }

    // Base date for the interval: due_date → completed_at → now. Empty PB date
    // fields are truthy zero DateTime objects (GH#11), so the same
    // task-date-sync helpers used by main.pb.js decide "has a real date".
    var baseMs = dateSync.toMs(rec.get('due_date'));
    if (isNaN(baseMs)) baseMs = dateSync.toMs(rec.get('completed_at'));
    var baseDate = isNaN(baseMs) ? new Date() : new Date(baseMs);

    var nextDate = recurrenceLib.getNextRecurringDate(repeatInterval, baseDate);
    if (!nextDate) return;

    // Reopening a completed recurring task and completing it again must not
    // spawn a second copy of the same occurrence: skip when this series
    // (same owner, title, interval) already has a task on the computed date.
    var dueFilterValue = nextDate.toISOString().replace('T', ' ');
    var existing = [];
    try {
      existing = $app.findRecordsByFilter(
        'tasks',
        'user = {:user} && title = {:title} && repeat_interval = {:interval} && due_date = {:due} && id != {:id}',
        '', 1, 0,
        { user: String(rec.get('user') || ''), title: String(rec.get('title') || ''), interval: String(repeatInterval), due: dueFilterValue, id: rec.id }
      ) || [];
    } catch (_errLookup) { existing = []; }
    if (existing.length > 0) {
      try {
        $app.logger().info('recurrence: occurrence for ' + dueFilterValue + ' already exists (' + existing[0].id + '), not creating another one for task ' + rec.id);
      } catch (_errLog2) { /* no logger */ }
      return;
    }

    var collection = $app.findCollectionByNameOrId('tasks');
    var next = new Record(collection);

    var rawLabels = rec.get('label') || rec.get('labels') || [];
    var labels = Array.isArray(rawLabels) ? rawLabels : (rawLabels ? [String(rawLabels)] : []);

    next.set('user', rec.get('user'));
    next.set('title', rec.get('title'));
    // Free-text fields belong to the series, not to one occurrence.
    if (rec.get('description')) next.set('description', rec.get('description'));
    if (rec.get('location')) next.set('location', rec.get('location'));
    next.set('status', 'todo');
    next.set('repeat_interval', repeatInterval);
    next.set('due_date', nextDate.toISOString());
    next.set('labels', labels);
    next.set('label', labels);
    next.set('is_private', rec.get('is_private') || false);
    next.set('blocked', false);
    next.set('archived', false);

    if (rec.get('priority')) next.set('priority', rec.get('priority'));
    if (rec.get('horizon')) next.set('horizon', rec.get('horizon'));
    if (rec.get('assigned_to')) next.set('assigned_to', rec.get('assigned_to'));
    if (rec.get('blocked_comment')) next.set('blocked_comment', rec.get('blocked_comment'));
    if (rec.get('all_day') === true) next.set('all_day', true);
    // Calendar placement: shift start_time/end_time by the same offset as the
    // due date so a timed block keeps its length on the next occurrence. A
    // block is only carried over when it has a start anchor; end_time alone
    // would dangle on the old day.
    var shiftMs = nextDate.getTime() - baseDate.getTime();
    var startMs = dateSync.toMs(rec.get('start_time'));
    if (!isNaN(startMs)) {
      next.set('start_time', new Date(startMs + shiftMs).toISOString());
      var endMs = dateSync.toMs(rec.get('end_time'));
      if (!isNaN(endMs) && endMs >= startMs) next.set('end_time', new Date(endMs + shiftMs).toISOString());
    }

    $app.save(next);
    try {
      $app.logger().info('recurrence: next occurrence ' + next.id + ' created for task ' + rec.id + ' (' + repeatInterval + ')');
    } catch (_errLog) { /* no logger */ }
  } catch (err) {
    // Never break the completion itself — log and move on.
    try {
      console.log('[recurrence] ERROR creating next occurrence: ' + String((err && err.name) || '') + ': ' + String((err && err.message) || err));
      $app.logger().error('recurrence: failed to create next occurrence: ' + String((err && err.message) || err));
    } catch (_logErr) { /* no logger */ }
  }
}, 'tasks');