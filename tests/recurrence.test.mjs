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

// A UTC-midnight value is a date-only due date: it stays at UTC midnight on
// the right calendar day (the hook passes a Date, so this is what it stores).
test('month recurrence keeps date-only values on UTC midnight', () => {
  const next = getNextRecurringDate('month', '2026-07-01T00:00:00.000Z')
  assert.equal(next.toISOString(), '2026-08-01T00:00:00.000Z')
})

test('monthly weekday recurrence keeps first weekday-of-month semantics for date-only values', () => {
  const next = getNextRecurringDate('month_weekday', '2026-06-01T00:00:00.000Z')
  assert.equal(next.toISOString(), '2026-07-06T00:00:00.000Z')
})

test('monthly weekday recurrence keeps second weekday-of-month semantics for date-only values', () => {
  const next = getNextRecurringDate('month_weekday', new Date('2026-06-08T00:00:00.000Z'))
  assert.equal(next.toISOString(), '2026-07-13T00:00:00.000Z')
})

test('monthly weekday recurrence across a year boundary', () => {
  const next = getNextRecurringDate('month_weekday', '2024-12-01T00:00:00.000Z') // first Sunday
  assert.equal(next.toISOString(), '2025-01-05T00:00:00.000Z')
})

test('a fifth weekday becomes the last weekday in a four-week month (#256)', () => {
  // 2026-05-29 is the fifth Friday of May; June has four Fridays.
  const next = getNextRecurringDate('month_weekday', '2026-05-29T00:00:00.000Z')
  assert.equal(next.toISOString(), '2026-06-26T00:00:00.000Z')
})

test('monthly recurrence clamps to the last day of a shorter month', () => {
  const next = getNextRecurringDate('month', '2026-01-31T00:00:00.000Z')
  assert.equal(next.toISOString(), '2026-02-28T00:00:00.000Z')
})

test('yearly recurrence from 29 February lands on 28 February', () => {
  const next = getNextRecurringDate('year', '2028-02-29T00:00:00.000Z')
  assert.equal(next.toISOString(), '2029-02-28T00:00:00.000Z')
})

// A timed value moves on the Europe/Amsterdam wall clock: 09:00 stays 09:00.
test('weekly timed recurrence keeps the Amsterdam wall-clock time across spring DST', () => {
  const next = getNextRecurringDate('week', '2026-03-23T08:00:00.000Z') // Mon 09:00 CET
  assert.equal(next.toISOString(), '2026-03-30T07:00:00.000Z') // Mon 09:00 CEST
})

test('daily timed recurrence keeps the Amsterdam wall-clock time across autumn DST', () => {
  const next = getNextRecurringDate('day', '2026-10-24T07:30:00.000Z') // Sat 09:30 CEST
  assert.equal(next.toISOString(), '2026-10-25T08:30:00.000Z') // Sun 09:30 CET
})

test('monthly weekday uses the Amsterdam weekday of a late-evening timed value', () => {
  // Sunday 2026-05-31 23:30 CEST is still Sunday 31 May in Amsterdam (21:30Z)
  // and the last Sunday of May; the next is the last Sunday of June.
  const next = getNextRecurringDate('month_weekday', '2026-05-31T21:30:00.000Z')
  assert.equal(next.toISOString(), '2026-06-28T21:30:00.000Z')
})

test('the hook path (Date input) and the string path agree', () => {
  for (const iso of ['2026-06-08T00:00:00.000Z', '2026-06-08T09:15:00.000Z']) {
    for (const interval of ['day', 'week', 'month', 'month_weekday', 'year']) {
      assert.equal(
        getNextRecurringDate(interval, new Date(iso)).toISOString(),
        getNextRecurringDate(interval, iso).toISOString(),
      )
    }
  }
})

test('the library does not use Intl (PocketBase\'s Goja runtime has none)', async () => {
  const { readFile } = await import('node:fs/promises')
  const source = await readFile(new URL('../pb_hooks/lib/recurrence.js', import.meta.url), 'utf8')
  assert.equal(/\bIntl\b/.test(source.replace(/\/\/.*$/gm, '')), false)
})

test('unknown repeat interval returns null', () => {
  assert.equal(getNextRecurringDate('fortnightly', '2026-06-01T00:00:00.000Z'), null)
})