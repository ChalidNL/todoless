import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const root = new URL('../', import.meta.url)
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8')

// Empty PocketBase date fields are TRUTHY DateTime objects in the JSVM:
// typeof 'object', isZero() === true, String() === '' (GH#11). Every empty
// date in the fixtures below mimics that so the tests fail on the old
// `t.get('start_time') || t.get('due_date')` truthiness handling.
function emptyDateTime() {
  return { isZero: () => true, toString: () => '', valueOf: () => '' }
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

const base = {
  id: 'task-x',
  user: 'user-1',
  title: 'Buy milk',
  status: 'todo',
  uid: '',
  description: '',
  location: '',
  timezone: '',
  rrule: '',
  is_private: false,
  label: [],
  labels: [],
}

// Runs the real GET /api/ics-export handler from pb_hooks/14_ics.pb.js in a
// vm sandbox and returns { status, body } like c.json().
function runExport(taskRecords) {
  const routerCalls = []
  const sandbox = {
    __hooks: '',
    routerAdd: (method, path, handler) => routerCalls.push({ method, path, handler }),
    // Route handlers require shared files from pb_hooks/lib; load the real
    // ones against this sandbox's $app, like PocketBase does.
    require: (p) => {
      const m = String(p).match(/\/lib\/([\w-]+\.js)$/)
      if (!m) throw new Error('unexpected require: ' + p)
      const mod = { module: { exports: {} }, $app: sandbox.$app, require: sandbox.require, __hooks: '' }
      vm.createContext(mod)
      vm.runInContext(read('pb_hooks/lib/' + m[1]), mod)
      return mod.module.exports
    },
    $app: {
      findRecordsByFilter: () => taskRecords,
      findRecordById: (name, id) => {
        if (name === 'users') return fakeRecord({ id, family_id: 'family-a' })
        throw new Error('missing record: ' + name)
      },
    },
  }
  vm.createContext(sandbox)
  vm.runInContext(read('pb_hooks/14_ics.pb.js'), sandbox)

  const exportRoute = routerCalls.find((r) => r.path === '/api/ics-export')
  assert.ok(exportRoute, 'export route registered')

  const auth = fakeRecord({ id: 'user-1', family_id: 'family-a' })
  const c = {
    requestInfo: () => ({ auth, query: {} }),
    get: () => null,
    json: (status, body) => ({ status, body }),
  }
  const res = exportRoute.handler(c)
  assert.equal(res.status, 200)
  return res.body
}

const vevents = (ics) => (ics.match(/BEGIN:VEVENT/g) || []).length

test('due-date-only task (no start_time) is exported from due_date without an empty DTEND', () => {
  const body = runExport([fakeRecord({
    ...base,
    id: 'due-only',
    due_date: '2026-09-28 12:00:00.000Z',
    start_time: emptyDateTime(),
    end_time: emptyDateTime(),
    all_day: false,
  })])
  const ics = body.ics
  assert.equal(body.count, 1)
  assert.equal(vevents(ics), 1)
  assert.match(ics, /BEGIN:VEVENT/)
  assert.match(ics, /DTSTART:20260928T120000Z/)
  assert.doesNotMatch(ics, /DTEND/) // no end → DTEND must be omitted, never empty
})

test('all-day task with only due_date is exported as a DATE event with exclusive DTEND', () => {
  const body = runExport([fakeRecord({
    ...base,
    id: 'all-day-due',
    due_date: '2026-09-28 12:00:00.000Z',
    start_time: emptyDateTime(),
    end_time: emptyDateTime(),
    all_day: true,
  })])
  const ics = body.ics
  assert.equal(body.count, 1)
  assert.equal(vevents(ics), 1)
  assert.match(ics, /DTSTART;VALUE=DATE:2026/)
  // GH#13: all-day DTEND is exclusive → single-day event ends the next day,
  // never equals DTSTART and never is empty.
  assert.match(ics, /DTEND;VALUE=DATE:2026/)
  assert.doesNotMatch(ics, /DTEND;VALUE=DATE:\s*(\r\n|$)/)
  const dtStart = ics.match(/DTSTART;VALUE=DATE:(\d+)/)[1]
  const dtEnd = ics.match(/DTEND;VALUE=DATE:(\d+)/)[1]
  assert.ok(dtEnd > dtStart, 'all-day DTEND must be exclusive (later than DTSTART)')
})

test('timed task without end_time emits DTSTART only, never an empty DTEND line', () => {
  const body = runExport([fakeRecord({
    ...base,
    id: 'timed-no-end',
    start_time: '2026-09-28 12:00:00.000Z',
    due_date: emptyDateTime(),
    end_time: emptyDateTime(),
    all_day: false,
  })])
  const ics = body.ics
  assert.equal(body.count, 1)
  assert.equal(vevents(ics), 1)
  assert.match(ics, /DTSTART:20260928T120000Z/)
  assert.doesNotMatch(ics, /DTEND/)
  assert.doesNotMatch(ics, /DTEND:\s*(\r\n|$)/)
})

test('timed task with start and end emits both DTSTART and DTEND in UTC format', () => {
  const body = runExport([fakeRecord({
    ...base,
    id: 'timed-with-end',
    start_time: '2026-09-28 12:00:00.000Z',
    end_time: '2026-09-28 13:30:00.000Z',
    due_date: emptyDateTime(),
    all_day: false,
  })])
  const ics = body.ics
  assert.equal(vevents(ics), 1)
  assert.match(ics, /DTSTART:20260928T120000Z/)
  assert.match(ics, /DTEND:20260928T133000Z/)
})

test('all-day task with start and distinct end emits exclusive DATE values', () => {
  const body = runExport([fakeRecord({
    ...base,
    id: 'all-day-range',
    start_time: '2026-09-28 12:00:00.000Z',
    end_time: '2026-09-30 12:00:00.000Z',
    due_date: emptyDateTime(),
    all_day: true,
  })])
  const ics = body.ics
  assert.equal(vevents(ics), 1)
  assert.match(ics, /DTSTART;VALUE=DATE:2026/)
  assert.match(ics, /DTEND;VALUE=DATE:2026/)
})

test('all-day task whose end equals its start gets an exclusive next-day DTEND', () => {
  const body = runExport([fakeRecord({
    ...base,
    id: 'all-day-zero',
    start_time: '2026-09-28 12:00:00.000Z',
    end_time: '2026-09-28 12:00:00.000Z',
    due_date: emptyDateTime(),
    all_day: true,
  })])
  const ics = body.ics
  assert.equal(vevents(ics), 1)
  assert.match(ics, /DTSTART;VALUE=DATE:2026/)
  assert.match(ics, /DTEND;VALUE=DATE:2026/)
  const dtStart = ics.match(/DTSTART;VALUE=DATE:(\d+)/)[1]
  const dtEnd = ics.match(/DTEND;VALUE=DATE:(\d+)/)[1]
  assert.ok(dtEnd > dtStart, 'same-day end must never yield a zero-length DTEND')
})

test('task with no real dates is skipped entirely', () => {
  const body = runExport([fakeRecord({
    ...base,
    id: 'no-dates',
    start_time: emptyDateTime(),
    due_date: emptyDateTime(),
    end_time: emptyDateTime(),
    all_day: false,
  })])
  const ics = body.ics
  // #234: a skipped task is not counted - the count is what the file contains
  assert.equal(body.count, 0)
  assert.equal(vevents(ics), 0)
  assert.doesNotMatch(ics, /BEGIN:VEVENT/)
})

test('mixed batch never emits an empty or zero-length DTEND and VEVENTs match tasks', () => {
  const body = runExport([
    fakeRecord({ ...base, id: 'a', start_time: '2026-09-28 12:00:00.000Z', end_time: emptyDateTime(), due_date: emptyDateTime(), all_day: false }),
    fakeRecord({ ...base, id: 'b', start_time: emptyDateTime(), due_date: '2026-09-29 12:00:00.000Z', end_time: emptyDateTime(), all_day: false }),
    fakeRecord({ ...base, id: 'c', start_time: emptyDateTime(), due_date: '2026-09-30 12:00:00.000Z', end_time: emptyDateTime(), all_day: true }),
    fakeRecord({ ...base, id: 'd', start_time: emptyDateTime(), due_date: emptyDateTime(), end_time: emptyDateTime(), all_day: false }),
  ])
  const ics = body.ics
  assert.equal(vevents(ics), 3)
  // #234: count reports the VEVENTs written, not the tasks considered -
  // task d had no usable date and was skipped
  assert.equal(body.count, 3)
  assert.doesNotMatch(ics, /DTEND:\s*(\r\n|$)/)
  for (const id of ['a', 'b', 'c']) {
    assert.match(ics, new RegExp(`UID:todoless-${id}@family-family-a`))
  }
  assert.doesNotMatch(ics, /UID:todoless-d@/)
})

test('export code never falls back on raw truthiness and guards DTEND emission', () => {
  const source = read('pb_hooks/lib/ics-feed.js')
  assert.match(source, /function hasDate\(/)
  // The old bug was the unguarded `var sd=t.get('start_time')||t.get('due_date')`;
  // comments may mention the pattern, so scope the negative assertion to code.
  assert.doesNotMatch(source, /var\s+sd\s*=\s*t\.get\('start_time'\)\s*\|\|/)
  assert.doesNotMatch(source, /var\s+st\s*=\s*t\.get\('start_time'\)\s*;/)
  assert.match(source, /if\(dtEnd\)ics\+=/)
})
test('export never contains another member\'s private task (behaviour, shared with the calendar feed)', () => {
  const body = runExport([
    fakeRecord({ ...base, id: 'mine-private', user: 'user-1', title: 'Mine private', is_private: true, due_date: '2026-09-28 12:00:00.000Z', start_time: emptyDateTime(), end_time: emptyDateTime() }),
    fakeRecord({ ...base, id: 'theirs-private', user: 'user-2', title: 'Theirs private', is_private: true, due_date: '2026-09-28 12:00:00.000Z', start_time: emptyDateTime(), end_time: emptyDateTime() }),
    fakeRecord({ ...base, id: 'theirs-shared', user: 'user-2', title: 'Theirs shared', due_date: '2026-09-28 12:00:00.000Z', start_time: emptyDateTime(), end_time: emptyDateTime() }),
  ])
  assert.match(body.ics, /SUMMARY:Mine private/)
  assert.match(body.ics, /SUMMARY:Theirs shared/)
  assert.doesNotMatch(body.ics, /Theirs private/)
})

// RFC 5545 line handling (formerly the stand-alone tests/ics-logic-test.js).
const utf8Len = (s) => Buffer.byteLength(s, 'utf8')
const physicalLines = (ics) => ics.split('\r\n').filter(Boolean)
const unfold = (ics) => ics.replace(/\r\n /g, '')

test('long multibyte values fold at 75 octets without splitting a character', () => {
  const desc = 'é'.repeat(40) + ' 🎉'.repeat(10)
  const ics = runExport([fakeRecord({ ...base, all_day: true, start_time: '2026-05-01T00:00:00.000Z', due_date: emptyDateTime(), end_time: emptyDateTime(), description: desc })]).ics
  for (const line of physicalLines(ics)) {
    assert.ok(utf8Len(line) <= 75, `line over 75 octets: ${utf8Len(line)}`)
    assert.ok(!/[\uD800-\uDBFF]$/.test(line) && !/^ ?[\uDC00-\uDFFF]/.test(line), 'surrogate pair split across a fold')
  }
  assert.ok(unfold(ics).includes('DESCRIPTION:' + desc))
})

test('carriage returns and newlines in text are escaped, never emitted raw', () => {
  const ics = runExport([fakeRecord({ ...base, all_day: true, start_time: '2026-05-02T00:00:00.000Z', due_date: emptyDateTime(), end_time: emptyDateTime(), description: 'first line\r\nsecond line' })]).ics
  assert.ok(unfold(ics).includes('DESCRIPTION:first line\\r\\nsecond line'))
  assert.doesNotMatch(ics.replace(/\r\n/g, ''), /[\r\n]/)
})

test('RRULE is folded like other lines and stripped of control characters', () => {
  const rrule = 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=20271231T000000Z;WKST=MO;BYSETPOS=1,2,3\u0007'
  const ics = runExport([fakeRecord({ ...base, start_time: '2026-05-04T08:00:00.000Z', due_date: emptyDateTime(), end_time: emptyDateTime(), rrule })]).ics
  for (const line of physicalLines(ics)) assert.ok(utf8Len(line) <= 75)
  assert.ok(unfold(ics).includes('RRULE:' + rrule.replace('\u0007', '')))
})

test('all-day dates use Europe/Amsterdam, not the server timezone', () => {
  const previous = process.env.TZ
  process.env.TZ = 'America/Los_Angeles' // west of UTC: local dates would shift a day back
  try {
    const ics = runExport([fakeRecord({ ...base, all_day: true, start_time: '2026-05-01T00:00:00.000Z', due_date: emptyDateTime(), end_time: emptyDateTime() })]).ics
    assert.match(ics, /DTSTART;VALUE=DATE:20260501\r\n/)
    assert.match(ics, /DTEND;VALUE=DATE:20260502\r\n/)
  } finally {
    if (previous === undefined) delete process.env.TZ
    else process.env.TZ = previous
  }
})
