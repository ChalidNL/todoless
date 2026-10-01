/// <reference path="../pb_data/types.d.ts" />

// Repairs the task privacy flip caused by z062_enforce_label_privacy on
// databases that already existed when it ran.
//
// z062 walked every task and read the legacy JSON field with
// task.get('labels'). In the PocketBase JSVM that returns the raw JSON bytes,
// which Goja exposes as an array of char codes. Every element therefore
// failed to resolve to a label record, the loop treated the task as carrying
// an unresolvable legacy label and applied its fail-closed rule:
// is_private = true. On an upgraded database this hit every task whose
// `labels` column was not NULL -- including the plain '[]' the app writes for
// tasks without labels -- so family members silently lost sight of each
// other's tasks. The canonical `label` relation was never backfilled either.
// (z061/z062 now read the field through getString(); this migration undoes
// the historical damage.)
//
// What is reverted, and only that:
//   * tasks that are private now,
//   * whose canonical `label` relation is still empty (the buggy loop never
//     filled it; a task the owner touched since would have it dual-written),
//   * whose legacy `labels` JSON is not NULL (NULL rows were never flipped),
//   * whose last write happened in the z062 run: `updated` lies between
//     applied(z061) / applied(z062) - 10 min and applied(z062), and inside the
//     contiguous burst of writes that ends at applied(z062) (no gap > 60 s),
//   * and whose legacy labels all resolve to existing label records (or are
//     empty). Tasks with an unresolvable legacy label stay private: that is
//     the fail-closed decision z062 meant to take.
// For the reverted tasks the canonical `label` relation is backfilled from
// the resolved legacy ids, which is what z062 was supposed to do for them.
//
// Raw SQL, as in z072: no record hooks, no realtime events. Idempotent: a
// second run finds no task that is private + empty relation + inside the
// window. Fresh installs have no z062 window with tasks in it and are a no-op.
// The down migration is a no-op -- a reverted flag cannot be told apart from
// a flag the user never set.

const WINDOW_MICROS = 10 * 60 * 1000 * 1000; // 10 minutes before applied(z062)
const BURST_GAP_MICROS = 60 * 1000 * 1000;   // writes of one migration run are never 60 s apart

function pbDate(micros) {
  // '2026-08-09 12:34:56.789Z' -- the format PocketBase stores in date/autodate columns
  return new Date(Math.floor(micros / 1000)).toISOString().replace('T', ' ');
}

function parseMicros(pbDateString) {
  const ms = Date.parse(String(pbDateString || '').replace(' ', 'T'));
  return isNaN(ms) ? null : ms * 1000;
}

function parseLegacyLabels(raw) {
  raw = String(raw === null || raw === undefined ? '' : raw).trim();
  if (!raw || raw === 'null') return [];
  let parsed;
  try { parsed = JSON.parse(raw); } catch (_) { return []; }
  if (!Array.isArray(parsed)) parsed = parsed === null || parsed === '' ? [] : [parsed];
  const out = [];
  for (const entry of parsed) {
    const id = String(entry === null || entry === undefined ? '' : entry).trim();
    if (id && out.indexOf(id) === -1) out.push(id);
  }
  return out;
}

migrate(
  (app) => {
    let tasks;
    try { tasks = app.findCollectionByNameOrId('tasks'); } catch (_) { return; }
    if (!tasks.fields.getByName('label') || !tasks.fields.getByName('labels') || !tasks.fields.getByName('is_private')) return;

    const applied = arrayOf(new DynamicModel({ file: '', applied: 0 }));
    app.db()
      .newQuery("SELECT file, applied FROM _migrations WHERE file IN ('z061_label_visibility.js', 'z062_enforce_label_privacy.js')")
      .all(applied);
    let appliedZ061 = 0;
    let appliedZ062 = 0;
    for (const row of applied) {
      if (row.file === 'z061_label_visibility.js') appliedZ061 = Number(row.applied) || 0;
      if (row.file === 'z062_enforce_label_privacy.js') appliedZ062 = Number(row.applied) || 0;
    }
    if (!appliedZ062) return; // z062 never ran here (it is applied in this same run on fresh databases)

    let lower = appliedZ062 - WINDOW_MICROS;
    if (appliedZ061 && appliedZ061 > lower) lower = appliedZ061;
    const upper = appliedZ062;

    const candidates = arrayOf(new DynamicModel({ id: '', labels: '', updated: '' }));
    app.db()
      .newQuery(
        'SELECT id, labels, updated FROM tasks ' +
        "WHERE (is_private = 1 OR is_private = 'true') " +
        "AND COALESCE(label, '') IN ('', '[]', 'null') " +
        "AND labels IS NOT NULL AND TRIM(labels) NOT IN ('', 'null') " +
        'AND updated >= {:lower} AND updated <= {:upper} ' +
        'ORDER BY updated DESC'
      )
      .bind({ lower: pbDate(lower), upper: pbDate(upper) })
      .all(candidates);
    if (candidates.length === 0) return;

    // Keep only the contiguous burst of writes that ends at applied(z062).
    const burst = [];
    let previous = upper;
    for (const candidate of candidates) {
      const at = parseMicros(candidate.updated);
      if (at === null || previous - at > BURST_GAP_MICROS) break;
      burst.push(candidate);
      previous = at;
    }
    if (burst.length === 0) return;

    const labelIds = arrayOf(new DynamicModel({ id: '' }));
    app.db().newQuery('SELECT id FROM labels').all(labelIds);
    const known = {};
    for (const row of labelIds) known[String(row.id)] = true;

    const now = pbDate(Date.now() * 1000);
    let reverted = 0;
    let keptPrivate = 0;
    for (const task of burst) {
      const legacy = parseLegacyLabels(task.labels);
      let unresolved = false;
      for (const id of legacy) {
        if (!known[id]) { unresolved = true; break; }
      }
      if (unresolved) { keptPrivate++; continue; }
      app.db()
        .newQuery('UPDATE tasks SET is_private = 0, label = {:label}, updated = {:updated} WHERE id = {:id}')
        .bind({ label: JSON.stringify(legacy), updated: now, id: task.id })
        .execute();
      reverted++;
    }
    console.log('[z073] label privacy repair: reverted ' + reverted + ' task(s) flipped private by z062 between ' +
      pbDate(lower) + ' and ' + pbDate(upper) + '; kept ' + keptPrivate + ' private (unresolvable legacy label).');
  },
  () => {}
);
