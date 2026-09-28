// GH#7 — unit tests for the pure recurrence date math (pb_hooks/lib/recurrence.js).
// Ported 1:1 from the legacy pb_hooks/cron/recurring-tasks.test.mjs (which tested
// the never-loaded cron file). Runs with `node --test tests/recurrence.test.mjs`
// (no server required).
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { getNextRecurringDate } = require('../pb_hooks/lib/recurrence.js')

test('daily recurrence keeps exact UTC midnight timestamps unchanged apart from the interval', () => {
  const next = getNextRecurringDate('day', '2026-06-01T00:00:00.000Z')
  assert.equal(next.toISOString(), '2026-06-02T00:00:00.000Z')
})

test('weekly recurrence keeps exact UTC midnight timestamps unchanged apart from the interval', () => {
  const next = getNextRecurringDate('week', '2026-06-01T00:00:00.000Z')
  assert.equal(next.toISOString(), '2026-06-08T00:00:00.000Z')
})

test('yearly recurrence keeps exact UTC midnight timestamps unchanged apart from the interval', () => {
  const next = getNextRecurringDate('year', '2026-06-01T00:00:00.000Z')
  assert.equal(next.toISOString(), '2027-06-01T00:00:00.000Z')
})

test('month recurrence preserves Amsterdam calendar day for UTC-midnight dates', () => {
  const next = getNextRecurringDate('month', '2026-07-01T00:00:00.000Z')
  assert.equal(next.toISOString(), '2026-08-01T10:00:00.000Z')
})

test('monthly weekday recurrence keeps first weekday-of-month semantics for UTC-midnight dates', () => {
  const next = getNextRecurringDate('month_weekday', '2026-06-01T00:00:00.000Z')
  assert.equal(next.toISOString(), '2026-07-06T10:00:00.000Z')
})

test('monthly weekday recurrence keeps second weekday-of-month semantics for UTC-midnight dates', () => {
  const next = getNextRecurringDate('month_weekday', '2026-06-08T00:00:00.000Z')
  assert.equal(next.toISOString(), '2026-07-13T10:00:00.000Z')
})

test('monthly weekday recurrence stays stable for UTC month-boundary timestamps in non-europe host timezones', () => {
  const next = getNextRecurringDate('month_weekday', '2024-09-01T00:00:00.000Z')
  assert.equal(next.toISOString(), '2024-10-06T10:00:00.000Z')
})

test('monthly recurrence stays stable for UTC-midnight dates across DST-sensitive months', () => {
  const next = getNextRecurringDate('month', '2024-11-01T00:00:00.000Z')
  assert.equal(next.toISOString(), '2024-12-01T11:00:00.000Z')
})

test('unknown repeat interval returns null', () => {
  assert.equal(getNextRecurringDate('fortnightly', '2026-06-01T00:00:00.000Z'), null)
})