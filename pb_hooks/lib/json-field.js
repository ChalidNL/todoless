// pb_hooks/lib/json-field.js
// Reading PocketBase JSON fields from hook code.
//
// In the PocketBase JSVM, record.get('<json field>') returns types.JSONRaw — a
// Go []byte. Goja exposes that as an Array OF BYTES: Array.isArray() is true,
// but the elements are the char codes of the JSON text ([91, 34, ...] for
// '["..."]', [110,117,108,108] for 'null'). Treating it as the decoded array
// therefore fails in two different ways:
//   * push(id) + record.set(...) → "Must be a valid json value" (save throws);
//   * slice()/concat(id)         → the bytes are persisted as numbers next to
//                                  the new id (silent data corruption);
//   * indexOf(id)/filter(...)    → never match, so cleanup code is a no-op.
// The reliable way is record.getString(field) (the JSON text) + JSON.parse.
//
// Pure JS — no PocketBase globals — so it can be required from hook handlers
// via require(__hooks + '/lib/json-field.js') and unit-tested with
// `node --test tests/*.test.mjs` (tests/json-field.test.mjs).

// Decoded array stored in a JSON field, or [] when the field is empty,
// not an array, or not valid JSON.
function readJsonArray(record, field) {
  var raw = '';
  try { raw = record.getString(field); } catch (e) { raw = ''; }
  if (raw === null || raw === undefined) return [];
  raw = String(raw).trim();
  if (!raw) return [];
  var parsed;
  try { parsed = JSON.parse(raw); } catch (e) { return []; }
  return Array.isArray(parsed) ? parsed : [];
}

// Same as readJsonArray, with every element coerced to a non-empty string
// (what id lists such as tasks.subtask_ids are expected to hold).
function readIdArray(record, field) {
  var arr = readJsonArray(record, field);
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var s = String(arr[i] === null || arr[i] === undefined ? '' : arr[i]).trim();
    if (s) out.push(s);
  }
  return out;
}

module.exports = { readJsonArray: readJsonArray, readIdArray: readIdArray };
