/// <reference path="../pb_data/types.d.ts" />

// #231: labels created through the collection API without `family` (the
// createRule allows `family = ""`) make every task that carries them
// un-editable, because the task rules require
// `label.family:each = @request.auth.family_id`. 18_ownership_guard now
// fills the field from the caller; this backfills labels that already exist
// with an empty family from their owner's (or user's) family.
//
// Raw SQL like z072: no record hooks, no realtime events. Idempotent - a
// second run matches nothing. Labels whose owner has no family are left
// alone (there is nothing to fill them with). Down is a no-op.
function hasField(collection, name) {
  return !!collection.fields.getByName(name);
}

migrate(
  (app) => {
    let labels;
    try {
      labels = app.findCollectionByNameOrId('labels');
    } catch (_) {
      return;
    }
    if (!hasField(labels, 'family') || !hasField(labels, 'owner')) return;
    app.db().newQuery(`
      UPDATE labels SET family = (
        SELECT u.family_id FROM users u
        WHERE u.id = CASE WHEN COALESCE(labels.owner, '') <> '' THEN labels.owner ELSE labels.user END
      )
      WHERE COALESCE(family, '') = ''
        AND COALESCE((
          SELECT u.family_id FROM users u
          WHERE u.id = CASE WHEN COALESCE(labels.owner, '') <> '' THEN labels.owner ELSE labels.user END
        ), '') <> ''
    `).execute();
  },
  () => {}
);
