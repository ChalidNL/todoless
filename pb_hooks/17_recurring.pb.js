// Recurring tasks (GH#7): when a task with repeat_interval moves into 'done',
// create the next occurrence right away. Runs after every successful update,
// so it covers the app and all APIs. Only the transition into done counts
// (editing a completed task creates nothing); the date rule is in
// lib/recurrence.js.
onRecordAfterUpdateSuccess((e) => {
  // First: the realtime broadcast is a later handler in this chain (#77).
  e.next();

  // Never break the completion itself: errors are logged and swallowed.
  try {
    var recurrenceLib = require(__hooks + '/lib/recurrence.js');
    var dateSync = require(__hooks + '/lib/task-date-sync.js');
    var rec = e.record;

    var repeatInterval = rec.get('repeat_interval');
    if (!repeatInterval) return;

    // Only react to the transition INTO done on a non-archived task.
    if (String(rec.get('status') || '') !== 'done') return;
    if (rec.get('archived') === true) return;

    // Already done before this update (e.g. a comment edit): nothing to do.
    var original = null;
    try { original = rec.original(); } catch (_errOriginal) { original = null; }
    if (original) {
      try {
        if (String(original.get('status') || '') === 'done') return;
      } catch (_errOriginalRead) { /* ignore */ }
    }

    // Base date: due_date, else completed_at, else now (empty PocketBase dates
    // are truthy zero objects, so toMs() decides what is set).
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
