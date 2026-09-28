// pb_hooks/lib/task-date-sync.js
// GH#79 — keep a task's calendar fields (start_time/end_time) in agreement
// with its due_date so the calendar and the task list never disagree about
// dates.
//
// Pure JS — no PocketBase globals — so the same file can be
//   * required from PB Goja hook handlers (require(__hooks + '/lib/task-date-sync.js')), and
//   * unit-tested by `node --test tests/*.test.mjs` (see tests/task-date-sync.test.mjs).
//
// Background (GH#11): in the PB JSVM an empty date field is a TRUTHY DateTime
// object (typeof 'object', isZero() === true, String() === '0001-01-01 ...'),
// not null/''. Bare truthiness checks like `if (!rec.get('start_time'))` are
// dead code. Every date check here goes through hasDate() (same semantics as
// the helper in pb_hooks/14_ics.pb.js).

// Whether a (possibly PocketBase DateTime) value represents a real date.
// Empty PB date fields (zero DateTime objects or empty strings) are unset.
var ZERO_DATE_PATTERNS = [/^0001-/, /^1970-01-01T00:00:00/, /^1970-01-01 00:00:00/];

function isZeroDateString(s) {
  for (var i = 0; i < ZERO_DATE_PATTERNS.length; i++) {
    if (ZERO_DATE_PATTERNS[i].test(s)) return true;
  }
  return false;
}

function hasDateValue(value) {
  if (!value) return false;
  if (typeof value === 'object' && typeof value.isZero === 'function') return !value.isZero();
  var s = String(value).trim();
  return s !== '' && !isZeroDateString(s);
}

// Milliseconds for a (possibly PocketBase DateTime) date value, or NaN.
function toMs(value) {
  if (!value) return NaN;
  // Empty PB DateTime objects are truthy zero objects — treat as unset (GH#11).
  if (typeof value === 'object' && typeof value.isZero === 'function' && value.isZero()) return NaN;
  if (typeof value.getTime === 'function') {
    try {
      var gms = value.getTime();
      if (gms !== null && gms !== undefined && !isNaN(gms)) return gms;
    } catch (e) { /* fall through to string parsing */ }
  }
  var s;
  try { s = String(value); } catch (e) { return NaN; }
  if (s.trim() === '' || isZeroDateString(s)) return NaN;
  // PocketBase DateTime stringifies with a space ("2026-09-28 14:00:00.000Z");
  // ISO input from the API uses "T". Normalize before parsing.
  var d = new Date(s.replace(' ', 'T'));
  return isNaN(d.getTime()) ? NaN : d.getTime();
}

function hasOwn(data, key) {
  return data && Object.prototype.hasOwnProperty.call(data, key);
}

// Canonical default (create path): start_time := due_date when the incoming
// record has a real due date but no real start time. This is the documented
// "single creation path" default in main.pb.js; before GH#11 the truthiness
// check made it dead code.
function ensureStartOnCreate(rec) {
  if (!hasDateValue(rec.get('start_time')) && hasDateValue(rec.get('due_date'))) {
    rec.set('start_time', rec.get('due_date'));
  }
}

// Update path: the task list editor only ever sends due_date. Keep start_time
// and end_time moving with it so the calendar block follows the due-date chip:
//   - due_date cleared            -> drop start_time/end_time (no ghost block)
//   - no start_time yet           -> adopt the canonical default start_time := due_date
//   - start_time exists           -> shift start_time/end_time by the same delta as due_date
// Requests that explicitly set start_time or end_time are authoritative and
// skip the sync entirely (calendar/API writes own those fields).
//
// rec  = the post-merge record (new values already applied)
// data = the request body (info.body || info.data)
// orig = the pre-update record, or null when unavailable
function syncOnDueDateChange(rec, data, orig) {
  // Explicit calendar fields win — the caller manages them.
  if (hasOwn(data, 'start_time') || hasOwn(data, 'end_time')) return;
  if (!hasOwn(data, 'due_date')) return;

  var newDueMs = toMs(data.due_date);
  if (isNaN(newDueMs)) {
    // due_date cleared: a stale start_time would leave a ghost calendar block
    // on the old day. Clear both calendar fields for a consistent "no date".
    if (hasDateValue(rec.get('start_time'))) rec.set('start_time', null);
    if (hasDateValue(rec.get('end_time'))) rec.set('end_time', null);
    return;
  }

  var startMs = toMs(rec.get('start_time'));
  if (isNaN(startMs)) {
    // No calendar time yet — adopt the canonical default (mirrors create).
    rec.set('start_time', data.due_date);
    // A stray end_time without a start_time has no valid anchor: shift it
    // with the old due_date when one exists, otherwise drop it so it cannot
    // dangle on the old day.
    var adoptEndMs = toMs(rec.get('end_time'));
    if (!isNaN(adoptEndMs)) {
      var adoptBaseMs = orig ? toMs(orig.get('due_date')) : NaN;
      if (isNaN(adoptBaseMs)) {
        // no baseline — a dangling end_time without a start_time cannot be anchored
        rec.set('end_time', null);
      } else if (adoptBaseMs !== newDueMs) {
        rec.set('end_time', new Date(adoptEndMs + (newDueMs - adoptBaseMs)).toISOString());
      }
    }
    return;
  }

  // Baseline for the delta: the previous due_date; fall back to the existing
  // start_time when the task had no due date yet (e.g. imported calendar
  // events) so the block re-anchors on the new due date.
  var baseMs = orig ? toMs(orig.get('due_date')) : NaN;
  if (isNaN(baseMs)) baseMs = startMs;

  var delta = newDueMs - baseMs;
  if (delta === 0) return;

  rec.set('start_time', new Date(startMs + delta).toISOString());
  var endMs = toMs(rec.get('end_time'));
  if (!isNaN(endMs)) rec.set('end_time', new Date(endMs + delta).toISOString());
}

module.exports = {
  hasDateValue: hasDateValue,
  toMs: toMs,
  ensureStartOnCreate: ensureStartOnCreate,
  syncOnDueDateChange: syncOnDueDateChange,
};