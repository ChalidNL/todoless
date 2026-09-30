// GH#17 / GH#28 / GH#102 — behavior tests for the backend issue fixes.
//
// Runs the REAL pb_hooks/main.pb.js and pb_hooks/12_api_routes.pb.js handlers
// in a vm sandbox (same harness as tests/ics-export-dates.test.mjs) and asserts
// on request/response behavior, not on source text:
//   #17  assigned_to must be an existing users record in the caller's family
//        (create / assign / update in /api/v1 and in 12_api_routes.pb.js),
//        empty id = unassign stays allowed.
//   #28  GET /api/entries and POST /api/v1 action=list scope the DB query to
//        the auth family (user.family_id, or user = userId without a family).
//   #102 updated_since is parsed and appended to the DB filter; invalid dates
//        return 400.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const root = new URL('../', import.meta.url)
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8')

function fakeRecord(values) {
  const record = { ...values }
  record.get = (name) => (name in record ? record[name] : undefined)
  record.set = (name, value) => {
    record[name] = value
    return record
  }
  return record
}

// In-memory PB stand-in: collections, findRecordsByFilter call capture,
// findRecordById lookups and saved-record capture.
function mkStore() {
  const users = {
    'user-own': fakeRecord({ id: 'user-own', family_id: 'family-a', role: 'member', member_status: '' }),
    'user-family': fakeRecord({ id: 'user-family', family_id: 'family-a', role: 'member', member_status: '' }),
    'user-other': fakeRecord({ id: 'user-other', family_id: 'family-b', role: 'member', member_status: '' }),
  }
  const baseTask = { status: 'todo', is_private: false, label: [], labels: [], assigned_to: '', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-02T00:00:00.000Z' }
  const tasks = {
    'task-own': fakeRecord({ id: 'task-own', user: 'user-own', title: 'Eigen', ...baseTask }),
    'task-1': fakeRecord({ id: 'task-1', user: 'user-family', title: 'Familie', ...baseTask }),
    'task-outside': fakeRecord({ id: 'task-outside', user: 'user-other', title: 'Extern', ...baseTask }),
  }
  const items = {
    'item-1': fakeRecord({ id: 'item-1', user: 'user-family', title: 'Melk', completed: false, labels: [], shop_id: '', quantity: 1, created: '2026-01-01T00:00:00.000Z', updated: '2026-01-02T00:00:00.000Z' }),
    'item-outside': fakeRecord({ id: 'item-outside', user: 'user-other', title: 'Bier', completed: false, labels: [], shop_id: '', quantity: 1, created: '2026-01-01T00:00:00.000Z', updated: '2026-01-02T00:00:00.000Z' }),
  }
  const colls = { tasks, items, users }
  const calls = [] // every findRecordsByFilter invocation
  const saved = []
  let recCounter = 0
  return {
    calls,
    saved,
    findRecordById: (name, id) => {
      if (colls[name] && colls[name][id]) return colls[name][id]
      throw new Error('missing record: ' + name + '/' + id)
    },
    $app: {
      findRecordsByFilter(collection, filter, sort, limit, offset, params) {
        calls.push({ collection, filter, sort, params })
        const src = colls[collection]
        return src ? Object.values(src) : []
      },
      findRecordById: (name, id) => (colls[name] && colls[name][id]) || (() => { throw new Error('missing ' + name + '/' + id) })(),
      save(rec) { saved.push(rec) },
      delete() {},
      logger: () => ({ error: () => {}, info: () => {} }),
      findCollectionByNameOrId: () => ({}),
    },
    Record: function (coll) {
      this.id = 'new-' + (++recCounter)
      this._d = {}
      this.set = (k, v) => { this._d[k] = v; return this }
      this.get = (k) => (k in this._d ? this._d[k] : undefined)
    },
  }
}

// Sandbox that loads a pb_hooks file, registers routerAdd handlers and provides
// the auth-lib/dates requires as pass-through stubs.
function loadHooks(file, extra = {}) {
  const routes = []
  const sandbox = {
    console,
    __hooks: '',
    onRecordCreate: () => {},
    onRecordUpdate: () => {},
    onRecordDelete: () => {},
    routerAdd: (method, path, handler) => routes.push({ method, path, handler }),
    require: (p) => {
      if (String(p).includes('lib/auth.js')) return { bearerAuthMiddleware: () => null }
      if (String(p).includes('lib/dates.js')) return { dateOrNull: (v) => v || null }
      if (String(p).includes('task-date-sync.js')) return {}
      throw new Error('unexpected require in sandbox: ' + p)
    },
    ...extra,
  }
  vm.createContext(sandbox)
  vm.runInContext(read(file), sandbox)
  return routes
}

function makeC({ auth, query = {}, body = {} }) {
  return {
    requestInfo: () => ({ auth, query, body }),
    get: () => undefined,
    request: { pathValue: () => 'task-own' },
    json: (status, data) => ({ status, data }),
  }
}

const authFamily = fakeRecord({ id: 'user-own', family_id: 'family-a', member_status: '' })
const authNoFamily = fakeRecord({ id: 'user-own', family_id: '', member_status: '' })

// ── GH#17: assignee validation in POST /api/v1 ──────────────────────────────
test('#17 /api/v1 create rejects a cross-family assignee and allows family/self/empty', () => {
  const store = mkStore()
  const routes = loadHooks('pb_hooks/main.pb.js', store)
  const v1 = routes.find((r) => r.method === 'POST' && r.path === '/api/v1').handler

  let res = v1(makeC({ auth: authFamily, body: { action: 'create', type: 'task', title: 'T', assignee_id: 'user-other' } }))
  assert.equal(res.status, 400)
  assert.equal(res.data.error, 'Invalid assignee')
  assert.equal(store.saved.length, 0)

  res = v1(makeC({ auth: authFamily, body: { action: 'create', type: 'task', title: 'T', assignee_id: 'user-family' } }))
  assert.equal(res.status, 201)
  assert.equal(store.saved[0].get('assigned_to'), 'user-family')

  store.saved.length = 0
  res = v1(makeC({ auth: authFamily, body: { action: 'create', type: 'task', title: 'T' } }))
  assert.equal(res.status, 201) // no assignee -> no validation, stays valid
})

test('#17 /api/v1 assign rejects a cross-family assignee, allows self and unassign', () => {
  const store = mkStore()
  const routes = loadHooks('pb_hooks/main.pb.js', store)
  const v1 = routes.find((r) => r.method === 'POST' && r.path === '/api/v1').handler

  let res = v1(makeC({ auth: authFamily, body: { action: 'assign', id: 'task-1', type: 'task', assignee_id: 'user-other' } }))
  assert.equal(res.status, 400)
  assert.equal(res.data.error, 'Invalid assignee')
  assert.equal(store.saved.length, 0)

  res = v1(makeC({ auth: authFamily, body: { action: 'assign', id: 'task-1', type: 'task', assignee_id: 'user-own' } }))
  assert.equal(res.status, 200)
  assert.equal(store.saved[0].get('assigned_to'), 'user-own')

  store.saved.length = 0
  res = v1(makeC({ auth: authFamily, body: { action: 'assign', id: 'task-1', type: 'task', assignee_id: '' } }))
  assert.equal(res.status, 200) // empty = unassign, always allowed
})

test('#17 /api/v1 update rejects a cross-family assignee, allows unassign', () => {
  const store = mkStore()
  const routes = loadHooks('pb_hooks/main.pb.js', store)
  const v1 = routes.find((r) => r.method === 'POST' && r.path === '/api/v1').handler

  let res = v1(makeC({ auth: authFamily, body: { action: 'update', id: 'task-1', type: 'task', assignee_id: 'user-other' } }))
  assert.equal(res.status, 400)
  assert.equal(res.data.error, 'Invalid assignee')
  assert.equal(store.saved.length, 0)

  res = v1(makeC({ auth: authFamily, body: { action: 'update', id: 'task-1', type: 'task', assignee_id: '' } }))
  assert.equal(res.status, 200)
  assert.ok(store.saved[0].get('assigned_to') === '')
})

// ── GH#17: mirror in pb_hooks/12_api_routes.pb.js ──────────────────────────
test('#17 POST /api/tasks rejects a cross-family assignee, allows a family assignee', () => {
  const store = mkStore()
  const routes = loadHooks('pb_hooks/12_api_routes.pb.js', store)
  const postTasks = routes.find((r) => r.method === 'POST' && r.path === '/api/tasks').handler

  let res = postTasks(makeC({ auth: authFamily, body: { title: 'T', assigned_to: 'user-other' } }))
  assert.equal(res.status, 400)
  assert.equal(res.data.error, 'Invalid assignee')
  assert.equal(store.saved.length, 0)

  res = postTasks(makeC({ auth: authFamily, body: { title: 'T', assigned_to: 'user-family' } }))
  assert.equal(res.status, 201)
  assert.equal(store.saved[0].get('assigned_to'), 'user-family')
})

test('#17 PATCH /api/tasks/{taskId} rejects a cross-family assignee, allows unassign', () => {
  const store = mkStore()
  const routes = loadHooks('pb_hooks/12_api_routes.pb.js', store)
  const patchTask = routes.find((r) => r.method === 'PATCH' && r.path === '/api/tasks/{taskId}').handler
  const ownerAuth = fakeRecord({ id: 'user-own', family_id: 'family-a', member_status: '' })
  const c = makeC({ auth: ownerAuth, body: {} })
  c.request.pathValue = () => 'task-own' // task owned by the caller

  let res = patchTask({ ...c, requestInfo: () => ({ auth: ownerAuth, query: {}, body: { assigned_to: 'user-other' } }) })
  assert.equal(res.status, 400)
  assert.equal(res.data.error, 'Invalid assignee')

  res = patchTask({ ...c, requestInfo: () => ({ auth: ownerAuth, query: {}, body: { assigned_to: '' } }) })
  assert.equal(res.status, 200)
  assert.equal(store.saved[0].get('assigned_to'), '')
})

// ── GH#28: DB-level family scope on both entries endpoints ─────────────────
test('#28 GET /api/entries queries with a family filter and keeps the JS privacy layer', () => {
  const store = mkStore()
  const routes = loadHooks('pb_hooks/main.pb.js', store)
  const entries = routes.find((r) => r.method === 'GET' && r.path === '/api/entries').handler

  const res = entries(makeC({ auth: authFamily }))
  assert.equal(res.status, 200)
  // DB filter carries the family scope for BOTH collections…
  assert.equal(store.calls.length, 2)
  for (const call of store.calls) {
    assert.equal(call.filter, 'user.family_id = {:familyId}')
    assert.equal(call.params.familyId, 'family-a')
  }
  // …and the JS privacy layer still filters out external users' records.
  // Own (task-own) + same-family (task-1, item-1) visible; user-other's
  // task-outside/item-outside must NOT leak through despite the DB filter
  // returning every record in the store.
  assert.equal(res.data.map((e) => e.id).sort().join(','), 'item-1,task-1,task-own')
  assert.ok(!res.data.some((e) => e.id === 'task-outside' || e.id === 'item-outside'))
})

test('#28 GET /api/entries falls back to user = userId when the account has no family', () => {
  const store = mkStore()
  const routes = loadHooks('pb_hooks/main.pb.js', store)
  const entries = routes.find((r) => r.method === 'GET' && r.path === '/api/entries').handler

  const res = entries(makeC({ auth: authNoFamily }))
  assert.equal(res.status, 200)
  assert.equal(store.calls[0].filter, 'user = {:userId}')
  assert.equal(store.calls[0].params.userId, 'user-own')
  // Only the caller's own records pass the second layer (task-own is owned by user-own).
  assert.equal(res.data.map((e) => e.id).join(','), 'task-own')
})

test('#28 POST /api/v1 action=list uses the family filter for tasks and items', () => {
  const store = mkStore()
  const routes = loadHooks('pb_hooks/main.pb.js', store)
  const v1 = routes.find((r) => r.method === 'POST' && r.path === '/api/v1').handler

  const res = v1(makeC({ auth: authFamily, body: { action: 'list' } }))
  assert.equal(res.status, 200)
  assert.equal(store.calls.length, 2)
  for (const call of store.calls) {
    assert.equal(call.filter, 'user.family_id = {:familyId}')
    assert.equal(call.params.familyId, 'family-a')
  }
  assert.deepEqual(res.data.map((e) => e.id).sort().join(','), 'item-1,task-1,task-own')
})

// ── GH#102: updated_since filtering + validation ────────────────────────────
test('#102 GET /api/entries rejects an invalid updated_since with 400', () => {
  const store = mkStore()
  const routes = loadHooks('pb_hooks/main.pb.js', store)
  const entries = routes.find((r) => r.method === 'GET' && r.path === '/api/entries').handler

  const res = entries(makeC({ auth: authFamily, query: { updated_since: 'geen-datum' } }))
  assert.equal(res.status, 400)
  assert.equal(res.data.error, 'Invalid updated_since')
  assert.equal(store.calls.length, 0) // no DB query ran
})

test('#102 GET /api/entries appends updated >= {:since} for a valid updated_since', () => {
  const store = mkStore()
  const routes = loadHooks('pb_hooks/main.pb.js', store)
  const entries = routes.find((r) => r.method === 'GET' && r.path === '/api/entries').handler

  const res = entries(makeC({ auth: authFamily, query: { updated_since: '2026-01-01T00:00:00Z' } }))
  assert.equal(res.status, 200)
  assert.equal(store.calls[0].filter, 'user.family_id = {:familyId} && updated >= {:since}')
  assert.equal(store.calls[0].params.since, '2026-01-01T00:00:00.000Z')
  assert.equal(store.calls[1].filter, 'user.family_id = {:familyId} && updated >= {:since}')
})

test('#102 POST /api/v1 action=list mirrors updated_since and its validation', () => {
  const store = mkStore()
  const routes = loadHooks('pb_hooks/main.pb.js', store)
  const v1 = routes.find((r) => r.method === 'POST' && r.path === '/api/v1').handler

  let res = v1(makeC({ auth: authFamily, body: { action: 'list' }, query: { updated_since: 'kapot' } }))
  assert.equal(res.status, 400)
  assert.equal(res.data.error, 'Invalid updated_since')

  res = v1(makeC({ auth: authFamily, body: { action: 'list' }, query: { updated_since: '2026-01-02T00:00:00Z' } }))
  assert.equal(res.status, 200)
  assert.equal(store.calls[0].filter, 'user.family_id = {:familyId} && updated >= {:since}')
  assert.equal(store.calls[0].params.since, '2026-01-02T00:00:00.000Z')
})