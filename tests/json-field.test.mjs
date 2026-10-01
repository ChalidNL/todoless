// Unit tests for pb_hooks/lib/json-field.js (GH#88 follow-up).
// PocketBase returns JSON fields from record.get() as a byte array in the JSVM;
// the helpers must read the JSON text via record.getString() instead.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { readJsonArray, readIdArray } = require('../pb_hooks/lib/json-field.js')

// Mimics a PocketBase record: getString() yields the JSON text, get() yields
// the raw bytes of that text (what Goja shows for types.JSONRaw).
function fakeRecord(jsonText) {
  return {
    getString: (field) => (field === 'subtask_ids' ? jsonText : ''),
    get: (field) => (field === 'subtask_ids' ? Array.from(Buffer.from(jsonText)) : null),
  }
}

test('readJsonArray decodes a stored id list', () => {
  assert.deepEqual(readJsonArray(fakeRecord('["abc123def456ghi","zzz"]'), 'subtask_ids'), ['abc123def456ghi', 'zzz'])
})

test('readJsonArray returns [] for empty, null and non-array values', () => {
  assert.deepEqual(readJsonArray(fakeRecord(''), 'subtask_ids'), [])
  assert.deepEqual(readJsonArray(fakeRecord('null'), 'subtask_ids'), [])
  assert.deepEqual(readJsonArray(fakeRecord('{"a":1}'), 'subtask_ids'), [])
  assert.deepEqual(readJsonArray(fakeRecord('"text"'), 'subtask_ids'), [])
  assert.deepEqual(readJsonArray(fakeRecord('not json'), 'subtask_ids'), [])
  assert.deepEqual(readJsonArray(fakeRecord('[]'), 'other_field'), [])
})

test('readJsonArray tolerates records without getString', () => {
  assert.deepEqual(readJsonArray({}, 'subtask_ids'), [])
  assert.deepEqual(readJsonArray({ getString: () => { throw new Error('boom') } }, 'subtask_ids'), [])
})

test('the raw record.get() value is a byte array, not the id list (documents the pitfall)', () => {
  const rec = fakeRecord('["abc"]')
  const raw = rec.get('subtask_ids')
  assert.ok(Array.isArray(raw))
  assert.notDeepEqual(raw, ['abc'])
  assert.equal(raw.indexOf('abc'), -1)
  assert.deepEqual(readJsonArray(rec, 'subtask_ids'), ['abc'])
})

test('readIdArray drops empty/null entries and stringifies the rest', () => {
  assert.deepEqual(readIdArray(fakeRecord('["a", "", null, 7, " b "]'), 'subtask_ids'), ['a', '7', 'b'])
})
