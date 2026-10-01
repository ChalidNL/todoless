// #224: a task's free-text note lives in two fields that grew apart —
// `blocked_comment` (what the app shows/edits as the task comment and what
// /api/v1 exposes as `description`) and `description` (added for ICS import/
// export). The record hooks keep them identical so every reader (app, API,
// calendar export/feed, ICS import) sees the same text.
//
// Pure JS (record.get/set only) so it can be unit-tested
// (tests/task-note.test.mjs) and required from hook handlers.

function text(record, field) {
  var v = record.get(field);
  return v === undefined || v === null ? '' : String(v);
}

/** New record: whichever field was provided fills the other. */
function syncNoteOnCreate(rec) {
  var comment = text(rec, 'blocked_comment');
  var description = text(rec, 'description');
  if (comment && !description) rec.set('description', comment);
  else if (description && !comment) rec.set('blocked_comment', description);
}

/**
 * Update: the field that changed in this save wins and is copied to the
 * other. When both changed, `blocked_comment` (the app's field) wins.
 * Records where the two already differ and neither changed are left alone.
 */
function syncNoteOnUpdate(rec, orig) {
  var comment = text(rec, 'blocked_comment');
  var description = text(rec, 'description');
  var commentChanged = comment !== text(orig, 'blocked_comment');
  var descriptionChanged = description !== text(orig, 'description');
  if (commentChanged) {
    if (description !== comment) rec.set('description', comment);
  } else if (descriptionChanged) {
    rec.set('blocked_comment', description);
  }
}

module.exports = { syncNoteOnCreate: syncNoteOnCreate, syncNoteOnUpdate: syncNoteOnUpdate };
