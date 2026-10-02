// #257 — mapping of imported RRULEs onto repeat_interval
// (pb_hooks/lib/ics-recurrence.js). Runs with `node --test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { rruleToRepeatInterval } = require('../pb_hooks/lib/ics-recurrence.js')
const { getAnchorParts } = require('../pb_hooks/lib/recurrence.js')

const map = (rrule, start) => rruleToRepeatInterval(rrule, getAnchorParts(start))

test('simple frequencies map onto the app model', () => {
  assert.equal(map('FREQ=DAILY', '2026-11-10T08:00:00.000Z'), 'day')
  assert.equal(map('RRULE:FREQ=WEEKLY', '2026-11-10T08:00:00.000Z'), 'week')
  assert.equal(map('FREQ=WEEKLY;BYDAY=TU;WKST=MO', '2026-11-10T08:00:00.000Z'), 'week')
  assert.equal(map('FREQ=MONTHLY', '2026-11-10T00:00:00.000Z'), 'month')
  assert.equal(map('FREQ=MONTHLY;BYMONTHDAY=10', '2026-11-10T00:00:00.000Z'), 'month')
  assert.equal(map('FREQ=YEARLY', '2026-11-10T00:00:00.000Z'), 'year')
  assert.equal(map('FREQ=YEARLY;BYMONTH=11;BYMONTHDAY=10', '2026-11-10T00:00:00.000Z'), 'year')
  assert.equal(map('freq=daily;interval=1', '2026-11-10T08:00:00.000Z'), 'day')
})

test('monthly by weekday maps only when it matches the start', () => {
  assert.equal(map('FREQ=MONTHLY;BYDAY=2TU', '2026-11-10T00:00:00.000Z'), 'month_weekday')
  assert.equal(map('FREQ=MONTHLY;BYDAY=+2TU', '2026-11-10T00:00:00.000Z'), 'month_weekday')
  assert.equal(map('FREQ=MONTHLY;BYDAY=3TU', '2026-11-10T00:00:00.000Z'), null)
  assert.equal(map('FREQ=MONTHLY;BYDAY=2WE', '2026-11-10T00:00:00.000Z'), null)
  assert.equal(map('FREQ=MONTHLY;BYDAY=-1MO', '2026-11-30T00:00:00.000Z'), 'month_weekday')
  assert.equal(map('FREQ=MONTHLY;BYDAY=-1MO', '2026-11-23T00:00:00.000Z'), null)
  // a 5th weekday is "the last" in the app, which RRULE n=5 is not
  assert.equal(map('FREQ=MONTHLY;BYDAY=5FR', '2026-05-29T00:00:00.000Z'), null)
})

test('the weekday of a timed start is the Amsterdam weekday', () => {
  // 23:30 CET on Monday 2026-11-09 is 22:30Z, still Monday in Amsterdam
  assert.equal(map('FREQ=WEEKLY;BYDAY=MO', '2026-11-09T22:30:00.000Z'), 'week')
})

test('anything the model cannot express stays unmapped', () => {
  for (const rule of [
    'FREQ=WEEKLY;INTERVAL=2',
    'FREQ=DAILY;COUNT=5',
    'FREQ=DAILY;UNTIL=20261231T000000Z',
    'FREQ=WEEKLY;BYDAY=MO,WE',
    'FREQ=MONTHLY;BYMONTHDAY=1,15',
    'FREQ=HOURLY',
    'FREQ=DAILY;BYHOUR=9',
    'FREQ=DAILY;FREQ=WEEKLY',
    'garbage',
    '',
  ]) {
    assert.equal(map(rule, '2026-11-10T08:00:00.000Z'), null, rule)
  }
  // RRULE skips short months / non-leap years; the app clamps: not mapped
  assert.equal(map('FREQ=MONTHLY', '2026-01-31T00:00:00.000Z'), null)
  assert.equal(map('FREQ=YEARLY', '2028-02-29T00:00:00.000Z'), null)
})
