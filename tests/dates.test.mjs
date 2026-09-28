// GH#11 — unit-tests the pure-PocketBase-free date helper (pb_hooks/lib/dates.js).
// Runs with `node --test tests/*.test.mjs` (no server required).
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const dates = require('../pb_hooks/lib/dates.js')

// Empty PocketBase date fields are TRUTHY DateTime objects in the JSVM
// (typeof 'object', isZero() === true, String() === '0001-01-01 00:00:00.000Z'),
// not null/''. The zero fixture below mimics that so tests fail on bare
// truthiness handling (the GH#11 dead-guard class).
function dt(value) {
  if (value === null) return null
  return { isZero: () => value === '', toString: () => (value === '' ? '0001-01-01 00:00:00.000Z' : value) }
}

function fakeRecord(values) {
  const record = { ...values }
  record.get = (name) => (name in record ? record[name] : undefined)
  return record
}

test('hasDateValue: empty PB DateTime object is NOT a real date (GH#11)', () => {
  assert.equal(dates.hasDateValue(dt('')), false)
})

test('hasDateValue: null / undefined / empty strings are not dates', () => {
  assert.equal(dates.hasDateValue(null), false)
  assert.equal(dates.hasDateValue(undefined), false)
  assert.equal(dates.hasDateValue(''), false)
  assert.equal(dates.hasDateValue('   '), false)
  assert.equal(dates.hasDateValue('0001-01-01 00:00:00.000Z'), false)
  assert.equal(dates.hasDateValue('1970-01-01 00:00:00.000Z'), false)
})

test('hasDateValue: real DateTime object / ISO string IS a date', () => {
  assert.equal(dates.hasDateValue(dt('2026-09-28T10:00:00.000Z')), true)
  assert.equal(dates.hasDateValue('2026-09-28 10:00:00.000Z'), true)
})

test('hasDate(record, field) understands zero DateTime', () => {
  const rec = fakeRecord({ due_date: dt('') })
  assert.equal(dates.hasDate(rec, 'due_date'), false)
  rec.due_date = dt('2026-09-28T10:00:00.000Z')
  assert.equal(dates.hasDate(rec, 'due_date'), true)
  assert.equal(dates.hasDate(null, 'due_date'), false)
})

test('toMs: zero/empty -> NaN, real date -> ms', () => {
  assert.ok(Number.isNaN(dates.toMs(dt(''))))
  assert.ok(Number.isNaN(dates.toMs(null)))
  assert.ok(Number.isNaN(dates.toMs('')))
  assert.equal(dates.toMs(dt('2026-09-28T10:00:00.000Z')), Date.parse('2026-09-28T10:00:00.000Z'))
  // PB formats DateTime with a space; toMs must normalize before parsing
  assert.equal(dates.toMs('2026-09-28 10:00:00.000Z'), Date.parse('2026-09-28T10:00:00.000Z'))
})

test('dateToString: empty -> "", real -> String value', () => {
  assert.equal(dates.dateToString(dt('')), '')
  assert.equal(dates.dateToString(null), '')
  assert.equal(dates.dateToString(undefined), '')
  assert.equal(dates.dateToString(dt('2026-09-28T10:00:00.000Z')), '2026-09-28T10:00:00.000Z')
})

test('dateOrNull: empty -> null, real -> String value (nullable API contract)', () => {
  assert.equal(dates.dateOrNull(dt('')), null)
  assert.equal(dates.dateOrNull(undefined), null)
  assert.equal(dates.dateOrNull(''), null)
  assert.equal(dates.dateOrNull(null), null)
  assert.equal(dates.dateOrNull(dt('2026-09-28T10:00:00.000Z')), '2026-09-28T10:00:00.000Z')
  assert.equal(dates.dateOrNull('2026-09-28 10:00:00.000Z'), '2026-09-28 10:00:00.000Z')
})