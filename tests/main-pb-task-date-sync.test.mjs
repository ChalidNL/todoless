// GH#79 — wiring test: the REAL pb_hooks/main.pb.js create/update hooks must
// call the task-date-sync lib so a calendar-created task's start_time/end_time
// move with due_date changes from the task list.
// Runs the hook registrations in a vm sandbox (like tests/ics-export-dates.test.mjs).
// Runs with `node --test tests/*.test.mjs` (no server required).
//
// The sandbox models the PocketBase >= 0.23 JSVM contract:
//   * onRecordCreate/onRecordUpdate take (handler, ...collectionTags) — the
//     pre-0.23 (collectionName, handler) order registers NOTHING on a real
//     server, so the sandbox rejects it loudly instead of silently accepting it
//     (that is how the dead registration went unnoticed, GH#99);
//   * model-level record events have no requestInfo(); handlers see what
//     changed through e.record.original();
//   * a handler must call e.next() or the save never happens.
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

const handlers = { createTasks: null, createItems: null, updateTasks: null }
function register(slot) {
  return (handler, ...tags) => {
    if (typeof handler !== 'function') {
      throw new Error(`record hooks take (handler, ...collectionTags); got ${typeof handler} first — the pre-0.23 (collection, handler) order registers nothing on PocketBase >= 0.23`)
    }
    if (tags.length === 0) throw new Error('record hook registered without a collection tag')
    for (const tag of tags) if (slot[tag]) slot[tag] = handler
  }
}
const createSlots = { tasks: null, items: null }
const updateSlots = { tasks: null }
const sandbox = {
  console,
  __hooks: '',
  onRecordCreate: (handler, ...tags) => {
    if (typeof handler !== 'function') throw new Error(`onRecordCreate: expected (handler, ...tags), got ${typeof handler} first — the pre-0.23 (collection, handler) order registers nothing on PocketBase >= 0.23`)
    if (tags.length === 0) throw new Error('onRecordCreate registered without a collection tag')
    if (tags.includes('tasks')) handlers.createTasks = handler
    if (tags.includes('items')) handlers.createItems = handler
  },
  onRecordUpdate: (handler, ...tags) => {
    if (typeof handler !== 'function') throw new Error(`onRecordUpdate: expected (handler, ...tags), got ${typeof handler} first — the pre-0.23 (collection, handler) order registers nothing on PocketBase >= 0.23`)
    if (tags.length === 0) throw new Error('onRecordUpdate registered without a collection tag')
    if (tags.includes('tasks')) handlers.updateTasks = handler
  },
  routerAdd: () => {},
  $app: {
    findRecordById: () => null,
    logger: () => ({ info: () => {} }),
    save: () => {},
  },
  require: (path) => {
    if (String(path).endsWith('task-date-sync.js')) return require('../pb_hooks/lib/task-date-sync.js')
    if (String(path).endsWith('task-note.js')) return require('../pb_hooks/lib/task-note.js')
    if (String(path).endsWith('task-parent.js')) return require('../pb_hooks/lib/task-parent.js')
    throw new Error('unexpected require in sandbox: ' + path)
  },
}
vm.createContext(sandbox)
vm.runInContext(read('pb_hooks/main.pb.js'), sandbox)

assert.ok(handlers.createTasks, 'tasks create hook registered')
assert.ok(handlers.createItems, 'items create hook registered')
assert.ok(handlers.updateTasks, 'tasks update hook registered')

// Model events: { record, next } — no requestInfo(). next() must be called
// exactly once, otherwise PocketBase would skip the save.
function runCreate(values) {
  const rec = fakeRecord(values)
  rec.getString = (name) => (rec[name] === undefined || rec[name] === null ? '' : String(rec[name]))
  let nextCalls = 0
  handlers.createTasks({ record: rec, next: () => { nextCalls++ } })
  assert.equal(nextCalls, 1, 'create hook must call e.next() exactly once')
  return rec
}

function runUpdate(values, originalValues) {
  const rec = fakeRecord(values)
  const orig = fakeRecord(originalValues)
  for (const r of [rec, orig]) {
    r.getString = (name) => (r[name] === undefined || r[name] === null ? '' : (Array.isArray(r[name]) ? JSON.stringify(r[name]) : String(r[name])))
  }
  rec.original = () => orig
  let nextCalls = 0
  handlers.updateTasks({ record: rec, next: () => { nextCalls++ } })
  assert.equal(nextCalls, 1, 'update hook must call e.next() exactly once')
  return rec
}

test('the hooks are registered with the PocketBase >= 0.23 signature (handler first, collection tag)', () => {
  const source = read('pb_hooks/main.pb.js')
  assert.doesNotMatch(source, /onRecord(Create|Update|Delete)\(\s*['"]/, 'legacy (collection, handler) order found — registers nothing on PB >= 0.23')
})

test('create hook applies canonical defaults when the client sends none', () => {
  const rec = runCreate({ title: 'Bare task', user: 'user-1', due_date: dt(''), start_time: dt('') })
  assert.equal(rec.get('status'), 'todo')
  assert.equal(rec.get('flag'), false)
  assert.equal(rec.get('is_private'), false)
  assert.equal(rec.get('focus'), false)
  assert.equal(rec.get('all_day'), false)
  // arrays come from the vm realm — compare by content, not prototype
  assert.equal(JSON.stringify(rec.get('labels')), '[]')
  assert.equal(JSON.stringify(rec.get('label')), '[]')
})

test('items create hook defaults quantity/completed/is_private', () => {
  const rec = fakeRecord({ title: 'Milk', user: 'user-1' })
  let nextCalls = 0
  handlers.createItems({ record: rec, next: () => { nextCalls++ } })
  assert.equal(nextCalls, 1)
  assert.equal(rec.get('quantity'), 1)
  assert.equal(rec.get('completed'), false)
  assert.equal(rec.get('is_private'), false)
})

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
  )
  assert.equal(String(rec.get('start_time')), D2)
  assert.equal(String(rec.get('end_time')), '2026-09-30T10:00:00.000Z')
})

test('update hook clears calendar fields when due_date is cleared', () => {
  const rec = runUpdate(
    { id: 't1', due_date: dt(null), start_time: dt(D1), end_time: dt('2026-09-28T11:00:00.000Z') },
    { id: 't1', due_date: dt(D1), start_time: dt(D1), end_time: dt('2026-09-28T11:00:00.000Z') },
  )
  assert.equal(rec.get('start_time'), null)
  assert.equal(rec.get('end_time'), null)
})

test('update hook leaves calendar fields alone when start_time changed explicitly in the same save', () => {
  const rec = runUpdate(
    { id: 't1', due_date: dt(D2), start_time: '2026-10-01T12:00:00.000Z', end_time: dt('2026-09-28T11:00:00.000Z') },
    { id: 't1', due_date: dt(D1), start_time: dt(D1), end_time: dt('2026-09-28T11:00:00.000Z') },
  )
  assert.equal(rec.get('start_time'), '2026-10-01T12:00:00.000Z')
  assert.equal(String(rec.get('end_time')), '2026-09-28T11:00:00.000Z')
})

test('update hook is a no-op for unrelated field updates', () => {
  const rec = runUpdate(
    { id: 't1', title: 'Renamed', due_date: dt(D1), start_time: dt(D1), end_time: dt('2026-09-28T11:00:00.000Z') },
    { id: 't1', title: 'Old', due_date: dt(D1), start_time: dt(D1), end_time: dt('2026-09-28T11:00:00.000Z') },
  )
  assert.equal(String(rec.get('start_time')), D1)
  assert.equal(String(rec.get('end_time')), '2026-09-28T11:00:00.000Z')
})

test('update hook adopts start_time := due_date when a dated task had no block yet', () => {
  const rec = runUpdate(
    { id: 't1', due_date: dt(D2), start_time: dt(''), end_time: dt('') },
    { id: 't1', due_date: dt(D1), start_time: dt(''), end_time: dt('') },
  )
  assert.equal(String(rec.get('start_time')), D2)
})

test('update hook mirrors a changed label relation into the legacy labels field', () => {
  const rec = runUpdate(
    { id: 't1', label: ['lab-1', 'lab-2'], labels: ['lab-1'], due_date: dt(D1), start_time: dt(D1) },
    { id: 't1', label: ['lab-1'], labels: ['lab-1'], due_date: dt(D1), start_time: dt(D1) },
  )
  assert.equal(JSON.stringify(rec.get('labels')), JSON.stringify(['lab-1', 'lab-2']))
})

test('update hook still calls next() when original() is unavailable', () => {
  const rec = fakeRecord({ id: 't1', due_date: dt(D2), start_time: dt(D1) })
  rec.original = () => { throw new Error('no original on this PB build') }
  let nextCalls = 0
  handlers.updateTasks({ record: rec, next: () => { nextCalls++ } })
  assert.equal(nextCalls, 1)
  assert.equal(String(rec.get('start_time')), D1, 'without a baseline nothing is shifted')
})

// #224: the v1 API "description" (blocked_comment) and the ICS description
// field are mirrored by the record hooks.
test('create hook mirrors blocked_comment and description', () => {
  assert.equal(runCreate({ title: 't', blocked_comment: 'from api' }).description, 'from api')
  assert.equal(runCreate({ title: 't', description: 'from ics' }).blocked_comment, 'from ics')
})

test('update hook mirrors whichever note field changed', () => {
  const edited = runUpdate({ title: 't', blocked_comment: 'new', description: 'old' }, { title: 't', blocked_comment: 'old', description: 'old' })
  assert.equal(edited.description, 'new')
  const imported = runUpdate({ title: 't', blocked_comment: 'old', description: 'ics' }, { title: 't', blocked_comment: 'old', description: 'old' })
  assert.equal(imported.blocked_comment, 'ics')
})
