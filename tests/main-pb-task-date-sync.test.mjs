// GH#79 — wiring test: the REAL pb_hooks/main.pb.js create/update hooks must
// call the task-date-sync lib so a calendar-created task's start_time/end_time
// move with due_date changes from the task list.
// Runs the hook registrations in a vm sandbox (like tests/ics-export-dates.test.mjs).
// Runs with `node --test tests/*.test.mjs` (no server required).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = new URL('../', import.meta.url)
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8')

// Empty PocketBase date fields are TRUTHY DateTime objects in the JSVM
// (typeof 'object', isZero() === true, String() === '0001-01-01 00:00:00.000Z').
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

const handlers = { createTasks: null, updateTasks: null }
const sandbox = {
  console,
  __hooks: '',
  onRecordCreate: (name, fn) => { if (name === 'tasks') handlers.createTasks = fn },
  onRecordUpdate: (name, fn) => { if (name === 'tasks') handlers.updateTasks = fn },
  routerAdd: () => {},
  $app: {
    findRecordById: () => null,
    logger: () => ({ info: () => {} }),
    save: () => {},
  },
  require: (path) => {
    if (String(path).endsWith('task-date-sync.js')) return require('../pb_hooks/lib/task-date-sync.js')
    throw new Error('unexpected require in sandbox: ' + path)
  },
}
vm.createContext(sandbox)
vm.runInContext(read('pb_hooks/main.pb.js'), sandbox)

assert.ok(handlers.createTasks, 'tasks create hook registered')
assert.ok(handlers.updateTasks, 'tasks update hook registered')

function runCreate(values) {
  const rec = fakeRecord(values)
  handlers.createTasks({
    record: rec,
    requestInfo: () => ({ body: {}, data: {}, auth: { id: 'user-1' } }),
  })
  return rec
}

function runUpdate(values, originalValues, requestBody = {}) {
  const rec = fakeRecord(values)
  rec.original = () => fakeRecord(originalValues)
  handlers.updateTasks({
    record: rec,
    requestInfo: () => ({ body: requestBody, data: requestBody }),
  })
  return rec
}

test('create hook applies start_time := due_date canonical default (GH#79/#11)', () => {
  const rec = runCreate({
    title: 'List task',
    status: 'todo',
    user: 'user-1',
    family_id: 'family-1',
    due_date: dt(D1),
    start_time: dt(''),
    end_time: dt(''),
  })
  assert.equal(String(rec.get('start_time')), D1)
})

test('create hook preserves an explicit start_time from the calendar', () => {
  const rec = runCreate({
    title: 'Calendar task',
    status: 'todo',
    user: 'user-1',
    family_id: 'family-1',
    due_date: dt(D1),
    start_time: dt('2026-09-28T08:30:00.000Z'),
    end_time: dt('2026-09-28T09:30:00.000Z'),
  })
  assert.equal(String(rec.get('start_time')), '2026-09-28T08:30:00.000Z')
})

test('update hook shifts start_time/end_time when the list changes due_date', () => {
  const rec = runUpdate(
    { id: 't1', due_date: dt(D2), start_time: dt(D1), end_time: dt('2026-09-28T11:00:00.000Z') },
    { id: 't1', due_date: dt(D1), start_time: dt(D1), end_time: dt('2026-09-28T11:00:00.000Z') },
    { due_date: D2 },
  )
  assert.equal(String(rec.get('start_time')), D2)
  assert.equal(String(rec.get('end_time')), '2026-09-30T10:00:00.000Z')
})

test('update hook clears calendar fields when due_date is cleared', () => {
  const rec = runUpdate(
    { id: 't1', due_date: dt(null), start_time: dt(D1), end_time: dt('2026-09-28T11:00:00.000Z') },
    { id: 't1', due_date: dt(D1), start_time: dt(D1), end_time: dt('2026-09-28T11:00:00.000Z') },
    { due_date: null },
  )
  assert.equal(rec.get('start_time'), null)
  assert.equal(rec.get('end_time'), null)
})

test('update hook leaves calendar fields alone when the request sets start_time explicitly', () => {
  const rec = runUpdate(
    { id: 't1', due_date: dt(D2), start_time: '2026-10-01T12:00:00.000Z', end_time: dt('2026-09-28T11:00:00.000Z') },
    { id: 't1', due_date: dt(D1), start_time: dt(D1), end_time: dt('2026-09-28T11:00:00.000Z') },
    { due_date: D2, start_time: '2026-10-01T12:00:00.000Z' },
  )
  assert.equal(rec.get('start_time'), '2026-10-01T12:00:00.000Z')
  assert.equal(String(rec.get('end_time')), '2026-09-28T11:00:00.000Z')
})

test('update hook is a no-op for unrelated field updates', () => {
  const rec = runUpdate(
    { id: 't1', title: 'Renamed', due_date: dt(D1), start_time: dt(D1), end_time: dt('2026-09-28T11:00:00.000Z') },
    { id: 't1', title: 'Old', due_date: dt(D1), start_time: dt(D1), end_time: dt('2026-09-28T11:00:00.000Z') },
    { title: 'Renamed' },
  )
  assert.equal(String(rec.get('start_time')), D1)
  assert.equal(String(rec.get('end_time')), '2026-09-28T11:00:00.000Z')
})

test('update hook falls back to the DB snapshot when original() is unavailable', () => {
  // PB JSVM versions without record.original(): the hook must still shift via
  // the findRecordById fallback (which the sandbox stubs to null → the lib
  // re-anchors on the existing start_time).
  const rec = fakeRecord({ id: 't1', due_date: dt(D2), start_time: dt(D1), end_time: dt('2026-09-28T11:00:00.000Z') })
  rec.original = () => null // simulate missing original API
  handlers.updateTasks({
    record: rec,
    requestInfo: () => ({ body: { due_date: D2 }, data: { due_date: D2 } }),
  })
  assert.equal(String(rec.get('start_time')), D2)
  assert.equal(String(rec.get('end_time')), '2026-09-30T10:00:00.000Z')
})