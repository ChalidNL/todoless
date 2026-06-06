import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

function loadRecurringHook() {
  const source = fs.readFileSync(new URL('./recurring-tasks.js', import.meta.url), 'utf8')
  const sandbox = {
    console,
    cronAdd: () => {},
    $app: {},
    RecordUpsertAction: function () {},
    Record: function () {},
  }

  vm.createContext(sandbox)
  vm.runInContext(source, sandbox)
  return sandbox
}

test('daily recurrence keeps exact UTC midnight timestamps unchanged apart from the interval', () => {
  const { getNextRecurringDate } = loadRecurringHook()
  const next = getNextRecurringDate('day', '2026-06-01T00:00:00.000Z')

  assert.equal(next.toISOString(), '2026-06-02T00:00:00.000Z')
})

test('weekly recurrence keeps exact UTC midnight timestamps unchanged apart from the interval', () => {
  const { getNextRecurringDate } = loadRecurringHook()
  const next = getNextRecurringDate('week', '2026-06-01T00:00:00.000Z')

  assert.equal(next.toISOString(), '2026-06-08T00:00:00.000Z')
})

test('yearly recurrence keeps exact UTC midnight timestamps unchanged apart from the interval', () => {
  const { getNextRecurringDate } = loadRecurringHook()
  const next = getNextRecurringDate('year', '2026-06-01T00:00:00.000Z')

  assert.equal(next.toISOString(), '2027-06-01T00:00:00.000Z')
})

test('month recurrence preserves Amsterdam calendar day for UTC-midnight dates', () => {
  const { getNextRecurringDate } = loadRecurringHook()
  const next = getNextRecurringDate('month', '2026-07-01T00:00:00.000Z')

  assert.equal(next.toISOString(), '2026-08-01T10:00:00.000Z')
})

test('monthly weekday recurrence keeps first weekday-of-month semantics for UTC-midnight dates', () => {
  const { getNextRecurringDate } = loadRecurringHook()
  const next = getNextRecurringDate('month_weekday', '2026-06-01T00:00:00.000Z')

  assert.equal(next.toISOString(), '2026-07-06T10:00:00.000Z')
})

test('monthly weekday recurrence keeps second weekday-of-month semantics for UTC-midnight dates', () => {
  const { getNextRecurringDate } = loadRecurringHook()
  const next = getNextRecurringDate('month_weekday', '2026-06-08T00:00:00.000Z')

  assert.equal(next.toISOString(), '2026-07-13T10:00:00.000Z')
})

test('monthly weekday recurrence stays stable for UTC month-boundary timestamps in non-europe host timezones', () => {
  const { getNextRecurringDate } = loadRecurringHook()
  const next = getNextRecurringDate('month_weekday', '2024-09-01T00:00:00.000Z')

  assert.equal(next.toISOString(), '2024-10-06T10:00:00.000Z')
})

test('monthly recurrence stays stable for UTC-midnight dates across DST-sensitive months', () => {
  const { getNextRecurringDate } = loadRecurringHook()
  const next = getNextRecurringDate('month', '2024-11-01T00:00:00.000Z')

  assert.equal(next.toISOString(), '2024-12-01T11:00:00.000Z')
})
