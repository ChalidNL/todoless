// GH#79 — calendar/list date agreement for tasks.
// Unit-tests the pure-PocketBase-free sync lib (pb_hooks/lib/task-date-sync.js).
// Runs with `node --test tests/*.test.mjs` (no server required).
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sync = require('../pb_hooks/lib/task-date-sync.js')

// Empty PocketBase date fields are TRUTHY DateTime objects in the JSVM
// (typeof 'object', isZero() === true, String() === '0001-01-01 00:00:00.000Z').
// Every empty date in the fixtures below mimics that so the tests fail on
// bare truthiness handling (GH#11).
function dt(value) {
  if (value === null) return null
  return { isZero: () => value === '', toString: () => (value === '' ? '0001-01-01 00:00:00.000Z' : value) }
}

function fakeRecord(values) {
  const record = { ...values }
  record.get = (name) => (name in record ? record[name] : undefined)
  record.set = (name, value) => {
    record[name] = value
    return record
  }
  return record
}

const D1 = '2026-09-28T10:00:00.000Z'
const D2 = '2026-09-30T09:00:00.000Z'

test('ensureStartOnCreate sets start_time := due_date when start_time is empty (canonical default)', () => {
  // start_time is a truthy zero DateTime object — the old `!rec.get('start_time')`
  // check would have skipped this (GH#11).
  const rec = fakeRecord({ due_date: dt(D1), start_time: dt('') })
  sync.ensureStartOnCreate(rec)
  assert.equal(String(rec.get('start_time')), D1)
})

test('ensureStartOnCreate keeps an explicit start_time', () => {
  const rec = fakeRecord({ due_date: dt(D1), start_time: dt('2026-09-28T08:30:00.000Z') })
  sync.ensureStartOnCreate(rec)
  assert.equal(String(rec.get('start_time')), '2026-09-28T08:30:00.000Z')
})

test('ensureStartOnCreate leaves record untouched without due_date', () => {
  const rec = fakeRecord({ due_date: dt(''), start_time: dt('') })
  sync.ensureStartOnCreate(rec)
  // zero DateTime objects are unchanged (still empty); String() is the zero string
  assert.equal(String(rec.get('start_time')), '0001-01-01 00:00:00.000Z')
  assert.equal(sync.hasDateValue(rec.get('start_time')), false)
})

test('syncOnDueDateChange shifts start_time/end_time by the due_date delta', () => {
  const orig = fakeRecord({ due_date: dt(D1), start_time: dt(D1), end_time: dt('2026-09-28T11:00:00.000Z') })
  const rec = fakeRecord({ due_date: dt(D2), start_time: dt(D1), end_time: dt('2026-09-28T11:00:00.000Z') })
  // delta = +1d23h (D2 - D1)
  sync.syncOnDueDateChange(rec, { due_date: D2 }, orig)
  assert.equal(rec.get('start_time'), '2026-09-30T09:00:00.000Z')
  assert.equal(rec.get('end_time'), '2026-09-30T10:00:00.000Z')
})

test('syncOnDueDateChange adopts canonical default when start_time was empty', () => {
  const orig = fakeRecord({ due_date: dt(D1), start_time: dt('') })
  const rec = fakeRecord({ due_date: dt(D2), start_time: dt('') })
  sync.syncOnDueDateChange(rec, { due_date: D2 }, orig)
  assert.equal(String(rec.get('start_time')), D2)
})

test('syncOnDueDateChange shifts a stray end_time with the old due baseline when adopting', () => {
  const orig = fakeRecord({ due_date: dt(D1), start_time: dt(''), end_time: dt('2026-09-28T11:00:00.000Z') })
  const rec = fakeRecord({ due_date: dt(D2), start_time: dt(''), end_time: dt('2026-09-28T11:00:00.000Z') })
  sync.syncOnDueDateChange(rec, { due_date: D2 }, orig)
  assert.equal(String(rec.get('start_time')), D2)
  assert.equal(String(rec.get('end_time')), '2026-09-30T10:00:00.000Z')
})

test('syncOnDueDateChange drops a stray end_time without a due baseline when adopting', () => {
  const orig = fakeRecord({ due_date: dt(''), start_time: dt(''), end_time: dt('2026-09-28T11:00:00.000Z') })
  const rec = fakeRecord({ due_date: dt(D2), start_time: dt(''), end_time: dt('2026-09-28T11:00:00.000Z') })
  sync.syncOnDueDateChange(rec, { due_date: D2 }, orig)
  assert.equal(String(rec.get('start_time')), D2)
  assert.equal(rec.get('end_time'), null)
})

test('syncOnDueDateChange clears start_time/end_time when due_date is cleared', () => {
  const orig = fakeRecord({ due_date: dt(D1), start_time: dt(D1), end_time: dt('2026-09-28T11:00:00.000Z') })
  const rec = fakeRecord({ due_date: dt(null), start_time: dt(D1), end_time: dt('2026-09-28T11:00:00.000Z') })
  sync.syncOnDueDateChange(rec, { due_date: null }, orig)
  assert.equal(rec.get('start_time'), null)
  assert.equal(rec.get('end_time'), null)
})

test('syncOnDueDateChange re-anchors on due_date when the task had only start_time', () => {
  // e.g. an ICS-imported event with a calendar time but no due date baseline.
  const orig = fakeRecord({ due_date: dt(''), start_time: dt(D1), end_time: dt('2026-09-28T11:00:00.000Z') })
  const rec = fakeRecord({ due_date: dt(D2), start_time: dt(D1), end_time: dt('2026-09-28T11:00:00.000Z') })
  sync.syncOnDueDateChange(rec, { due_date: D2 }, orig)
  assert.equal(rec.get('start_time'), '2026-09-30T09:00:00.000Z')
  assert.equal(rec.get('end_time'), '2026-09-30T10:00:00.000Z')
})

test('syncOnDueDateChange leaves calendar fields alone when the request sets start_time explicitly', () => {
  const orig = fakeRecord({ due_date: dt(D1), start_time: dt(D1) })
  const rec = fakeRecord({ due_date: dt(D2), start_time: '2026-10-01T12:00:00.000Z' })
  sync.syncOnDueDateChange(rec, { due_date: D2, start_time: '2026-10-01T12:00:00.000Z' }, orig)
  assert.equal(rec.get('start_time'), '2026-10-01T12:00:00.000Z')
})

test('syncOnDueDateChange skips entirely when the request sets end_time explicitly', () => {
  const orig = fakeRecord({ due_date: dt(D1), start_time: dt(D1), end_time: dt('2026-09-28T11:00:00.000Z') })
  const rec = fakeRecord({ due_date: dt(D2), start_time: dt(D1), end_time: '2026-10-01T13:00:00.000Z' })
  sync.syncOnDueDateChange(rec, { due_date: D2, end_time: '2026-10-01T13:00:00.000Z' }, orig)
  assert.equal(String(rec.get('start_time')), D1) // untouched
  assert.equal(rec.get('end_time'), '2026-10-01T13:00:00.000Z') // explicit value wins
})

test('syncOnDueDateChange is a no-op when due_date did not move', () => {
  const orig = fakeRecord({ due_date: dt(D1), start_time: dt(D1), end_time: dt('2026-09-28T11:00:00.000Z') })
  const rec = fakeRecord({ due_date: dt(D1), start_time: dt(D1), end_time: dt('2026-09-28T11:00:00.000Z') })
  sync.syncOnDueDateChange(rec, { due_date: D1 }, orig)
  assert.equal(String(rec.get('start_time')), D1)
  assert.equal(String(rec.get('end_time')), '2026-09-28T11:00:00.000Z')
})

test('syncOnDueDateChange works without an original record by anchoring on start_time', () => {
  const rec = fakeRecord({ due_date: dt(D2), start_time: dt(D1), end_time: dt('2026-09-28T11:00:00.000Z') })
  sync.syncOnDueDateChange(rec, { due_date: D2 }, null)
  assert.equal(rec.get('start_time'), '2026-09-30T09:00:00.000Z')
  assert.equal(rec.get('end_time'), '2026-09-30T10:00:00.000Z')
})