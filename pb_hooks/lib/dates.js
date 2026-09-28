// pb_hooks/lib/dates.js
// GH#11 — empty PocketBase date fields are TRUTHY DateTime objects in the JSVM
// (typeof 'object', isZero() === true, String() === ''), not null/''. Bare
// truthiness checks like `if (!rec.get('start_time'))` are dead code, so every
// date comparison in pb_hooks must go through the helpers here.
//
// Pure JS — no PocketBase globals — so the same file can be
//   * required from PB Goja hook handlers (require(__hooks + '/lib/dates.js')), and
//   * unit-tested by `node --test tests/*.test.mjs` (see tests/dates.test.mjs).
//
// Semantics match the proven helpers in pb_hooks/lib/task-date-sync.js (also
// GH#11-aware); task-date-sync keeps its own copies because it is required
// directly from Node tests and must stay free of __hooks at module scope.

var ZERO_DATE_PATTERNS = [/^0001-/, /^1970-01-01T00:00:00/, /^1970-01-01 00:00:00/];

function isZeroDateString(s) {
  for (var i = 0; i < ZERO_DATE_PATTERNS.length; i++) {
    if (ZERO_DATE_PATTERNS[i].test(s)) return true;
  }
  return false;
}

// Whether a (possibly PocketBase DateTime) value represents a REAL date.
// Empty PB date fields (zero DateTime objects or empty strings) are unset.
function hasDateValue(value) {
  if (!value) return false;
  if (typeof value === 'object' && typeof value.isZero === 'function') return !value.isZero();
  var s = String(value).trim();
  return s !== '' && !isZeroDateString(s);
}

// Convenience for record-ish objects: hasDate(rec, 'start_time').
function hasDate(record, field) {
  if (!record || typeof record.get !== 'function') return false;
  return hasDateValue(record.get(field));
}

// Milliseconds for a (possibly PocketBase DateTime) date value, or NaN.
function toMs(value) {
  if (!hasDateValue(value)) return NaN;
  if (typeof value.getTime === 'function') {
    try {
      var gms = value.getTime();
      if (gms !== null && gms !== undefined && !isNaN(gms)) return gms;
    } catch (e) { /* fall through to string parsing */ }
  }
  var s;
  try { s = String(value); } catch (e) { return NaN; }
  // PocketBase DateTime stringifies with a space ("2026-09-28 14:00:00.000Z");
  // ISO input from the API uses "T". Normalize before parsing.
  var d = new Date(s.replace(' ', 'T'));
  return isNaN(d.getTime()) ? NaN : d.getTime();
}

// '' for empty/zero dates, String(value) otherwise (PB format).
function dateToString(value) {
  return hasDateValue(value) ? String(value) : '';
}

// null for empty/zero dates, String(value) otherwise. For nullable API fields
// (OpenAPI `type: string, nullable: true`) an empty PB date must serialize as
// null; `rec.get('expires_at') || null` can NOT do that because a zero DateTime
// object is truthy (GH#11).
function dateOrNull(value) {
  return hasDateValue(value) ? String(value) : null;
}

module.exports = {
  isZeroDateString: isZeroDateString,
  hasDateValue: hasDateValue,
  hasDate: hasDate,
  toMs: toMs,
  dateToString: dateToString,
  dateOrNull: dateOrNull,
};