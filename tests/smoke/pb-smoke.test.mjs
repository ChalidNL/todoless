// GH#98 — PocketBase integration smoke suite.
//
// Runs against a REAL PocketBase booted with the repo's pb_hooks + pb_migrations
// (see scripts/pb-smoke.sh). Uses node:test + global fetch — no browser.
//
// Sequence per GH#98: setup-status → first admin onboarding → invite → second
// user → shared vs private visibility → block/unblock → complete a recurring
// task → ICS export → password change → companion register → OpenAPI paths vs
// registered routes.
//
// KNOWN-BROKEN flows are marked `{ todo: '<ticket ref>' }`: the assertion still
// runs and shows as todo-failure in output, but does not fail the run. Flip them
// to active tests when the referenced fix tickets land:
//   - companion register   -> GH#8  (t_gh41a39209)
//   - block enforcement    -> follow-up (t_318f2396)
//   - ICS VEVENT for tasks -> GH#12 (t_gh246847d0)
//
// GH#65 OpenAPI parity gate (active, not todo):
//   - every documented path (from /api/openapi.json) must be registered by a
//     routerAdd() in pb_hooks/*.pb.js or by PocketBase-native collection CRUD
//   - every hook-registered route must be documented (vice versa)
//   - every documented path must answer on the live server with its documented
//     method (probe; 404 = missing route)
//
// Env: PB_URL (default http://127.0.0.1:8090)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = process.env.PB_URL || 'http://127.0.0.1:8090'

async function api(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, data }
}

async function auth(identity, password) {
  const r = await api('POST', '/api/collections/users/auth-with-password', { body: { identity, password } })
  return { token: r.data?.token, record: r.data?.record }
}

// --- 0. Server sanity ------------------------------------------------
// PB_VERSION is exported by scripts/pb-smoke.sh (default '0.40.4'); the
// endpoint reports the real runtime version, so the expectation must come
// from the launched binary, not a hard-coded literal (GH#33).
const EXPECTED_PB = process.env.PB_VERSION || '0.40.4'

test('pb is reachable: health, version, hook-health', async () => {
  const health = await api('GET', '/api/health')
  assert.equal(health.status, 200)

  const version = await api('GET', '/api/version')
  assert.equal(version.status, 200)
  assert.equal(version.data?.pb, EXPECTED_PB)
  // branch/commit are no longer hard-coded (GH#33): they mirror the env the
  // binary was booted with (build-time baked, or exported by the caller).
  // CI boots clean, so they fall back to 'unknown' instead of pretending to
  // be main/a SHA.
  assert.equal(version.data?.branch, process.env.TODOLESS_BRANCH || 'unknown')
  assert.equal(version.data?.commit, process.env.COMMIT_SHA || 'unknown')

  const hook = await api('GET', '/api/hook-health')
  assert.equal(hook.status, 200)
  assert.equal(hook.data?.ok, true)
})

// --- 0b. GH#56: request-logger must see real status codes -------------
test('request logger records 4xx statuses (unauthenticated + bad input)', async () => {
  // Custom-route 401 — the request-logger middleware must emit a warn line
  // (verified by scripts/pb-smoke.sh against serve.log afterwards).
  const noAuth = await api('POST', '/api/invites/create', { body: { type: 'human' } })
  assert.equal(noAuth.status, 401)

  // Custom-route 400 — also a warn line, and the response body must be intact.
  // (GH#26 removed the debug record-creating endpoint; validate-invite
  // without a code is the auth-free custom-route 400 used instead.)
  const badInput = await api('GET', '/api/validate-invite')
  assert.equal(badInput.status, 400)
  assert.equal(badInput.data?.message, 'code required')
})

// --- 1. setup-status (fresh boot has no users) -----------------------
test('setup-status reports a fresh instance', async () => {
  const r = await api('GET', '/api/setup-status')
  assert.equal(r.status, 200)
  assert.equal(r.data?.has_users, false)
  assert.equal(r.data?.setup_complete, false)
})

// --- 2. First admin onboarding ---------------------------------------
let admin = null
let adminToken = null

test('first admin registers via /api/register (bootstrap)', async () => {
  const r = await api('POST', '/api/register', {
    body: {
      email: 'admin@smoke.test', password: 'password123', passwordConfirm: 'password123',
      name: 'Smoke Admin', family_name: 'Smoke Family', user_type: 'family_member', language: 'en',
    },
  })
  assert.equal(r.status, 201)
  assert.ok(r.data?.user?.id, 'expected user id')
  assert.equal(r.data?.user?.role, 'admin')
  assert.ok(r.data?.user?.family_id, 'expected family_id')
  admin = r.data.user
})

test('admin can authenticate', async () => {
  const a = await auth('admin@smoke.test', 'password123')
  assert.ok(a.token, 'expected token')
  adminToken = a.token
})

// --- 3. Invite --------------------------------------------------------
let inviteCode = null

test('admin creates an invite (12-char code)', async () => {
  const r = await api('POST', '/api/invites/create', { token: adminToken, body: { type: 'human' } })
  assert.equal(r.status, 201)
  assert.equal(r.data?.code?.length, 12)
  inviteCode = r.data.code
})

test('invite validates publicly', async () => {
  const r = await api('GET', `/api/validate-invite?code=${encodeURIComponent(inviteCode)}`)
  assert.equal(r.status, 200)
  assert.equal(r.data?.valid, true)
  assert.equal(r.data?.family_id, admin.family_id)
})

// --- 4. Second user ---------------------------------------------------
let member = null
let memberToken = null

test('second user registers with the invite code', async () => {
  const r = await api('POST', '/api/register', {
    body: {
      email: 'member@smoke.test', password: 'password123', passwordConfirm: 'password123',
      name: 'Smoke Member', invite_code: inviteCode, user_type: 'family_member', language: 'en',
    },
  })
  assert.equal(r.status, 201)
  assert.ok(r.data?.user?.id, 'expected user id')
  assert.equal(r.data?.user?.role, 'member')
  assert.equal(r.data?.user?.family_id, admin.family_id, 'member joins the same family')
  member = r.data.user
})

test('member can authenticate', async () => {
  const a = await auth('member@smoke.test', 'password123')
  assert.ok(a.token, 'expected token')
  memberToken = a.token
})

// --- 5. Shared vs private visibility ----------------------------------
test('member sees shared but not private tasks (v1 list + native API)', async () => {
  // Admin creates one shared and one private task via the native records API
  // (the /api/v1 create action does not carry is_private).
  const shared = await api('POST', '/api/collections/tasks/records', {
    token: adminToken,
    body: { title: 'Smoke shared task', is_private: false, status: 'todo', user: admin.id },
  })
  assert.equal(shared.status, 200)

  const priv = await api('POST', '/api/collections/tasks/records', {
    token: adminToken,
    body: { title: 'Smoke private task', is_private: true, status: 'todo', user: admin.id },
  })
  assert.equal(priv.status, 200)
  assert.equal(priv.data?.is_private, true)

  const v1 = await api('POST', '/api/v1', { token: memberToken, body: { action: 'list' } })
  assert.equal(v1.status, 200)
  const v1Titles = (v1.data?.items || (Array.isArray(v1.data) ? v1.data : [])).map((i) => i.title)
  assert.ok(v1Titles.includes('Smoke shared task'), 'shared task should be visible')
  assert.ok(!v1Titles.includes('Smoke private task'), 'private task must be hidden')

  const native = await api('GET', '/api/collections/tasks/records?perPage=100', { token: memberToken })
  assert.equal(native.status, 200)
  const nativeTitles = (native.data?.items || []).map((i) => i.title)
  assert.ok(nativeTitles.includes('Smoke shared task'), 'shared task should be visible natively')
  assert.ok(!nativeTitles.includes('Smoke private task'), 'private task must be hidden natively')
})

// --- 6. Block/unblock --------------------------------------------------
test('admin blocks the member', async () => {
  const r = await api('POST', '/api/v1', {
    token: adminToken, body: { action: 'set_user_block', user_id: member.id, blocked: true },
  })
  assert.equal(r.status, 200)
  assert.equal(r.data?.blocked, true)
})

test('blocked member is rejected on read paths', { todo: 'block enforcement follow-up t_318f2396' }, async () => {
  // Currently broken: member_status=blocked is stored but /api/v1 and native
  // reads still return 200. Assertion stays as todo until t_318f2396 lands.
  const v1 = await api('POST', '/api/v1', { token: memberToken, body: { action: 'list' } })
  assert.equal(v1.status, 401)
})

test('admin unblocks the member', async () => {
  const r = await api('POST', '/api/v1', {
    token: adminToken, body: { action: 'set_user_block', user_id: member.id, blocked: false },
  })
  assert.equal(r.status, 200)
  assert.equal(r.data?.blocked, false)
})

test('unblocked member regains access', async () => {
  const v1 = await api('POST', '/api/v1', { token: memberToken, body: { action: 'list' } })
  assert.equal(v1.status, 200)
})

// --- 6b. GH#27 member deletion retention -------------------------------
async function registerDisposableMember(email, name) {
  const invite = await api('POST', '/api/invites/create', { token: adminToken, body: { type: 'human' } })
  assert.equal(invite.status, 201)
  const registered = await api('POST', '/api/register', {
    body: { email, password: 'password123', passwordConfirm: 'password123', name, invite_code: invite.data.code, user_type: 'family_member', language: 'en' },
  })
  assert.equal(registered.status, 201)
  const login = await auth(email, 'password123')
  assert.ok(login.token, 'expected disposable member token')
  return { user: registered.data.user, token: login.token }
}

async function getRecord(collection, id, token = adminToken) {
  return api('GET', `/api/collections/${collection}/records/${id}`, { token })
}

test('deleting a member preserves family-visible records and blocks native user delete (GH#27)', async () => {
  const disposable = await registerDisposableMember('delete-target@smoke.test', 'Delete Target')
  const target = disposable.user
  const targetToken = disposable.token

  const label = await api('POST', '/api/collections/labels/records', {
    token: targetToken,
    body: { name: 'Delete Target Label', color: '#ff00aa', is_private: false, visibility: 'family', owner: target.id, family: admin.family_id, user: target.id, shared_with: [admin.id] },
  })
  assert.equal(label.status, 200)

  const task = await api('POST', '/api/collections/tasks/records', {
    token: targetToken,
    body: { title: 'Delete Target Task', is_private: false, status: 'todo', user: target.id, assigned_to: target.id, completed_by: target.id, label: [label.data.id] },
  })
  assert.equal(task.status, 200)

  const item = await api('POST', '/api/collections/items/records', {
    token: targetToken,
    body: { title: 'Delete Target Grocery', completed: false, user: target.id, assigned_to: target.id },
  })
  assert.equal(item.status, 200)

  const note = await api('POST', '/api/collections/notes/records', {
    token: targetToken,
    body: { title: 'Delete Target Note', content: 'must survive member deletion', is_private: false, user: target.id, assigned_to: target.id },
  })
  assert.equal(note.status, 200)

  const shop = await api('POST', '/api/collections/shops/records', {
    token: targetToken,
    body: { name: 'Delete Target Shop', color: '#00aaff', user: target.id },
  })
  assert.equal(shop.status, 200)

  const privateTask = await api('POST', '/api/collections/tasks/records', {
    token: targetToken,
    body: { title: 'Delete Target Private Task', is_private: true, status: 'todo', user: target.id },
  })
  assert.equal(privateTask.status, 200)

  const nativeDelete = await api('DELETE', `/api/collections/users/records/${target.id}`, { token: adminToken })
  assert.notEqual(nativeDelete.status, 204, 'native users delete must be blocked')
  assert.ok(nativeDelete.status >= 400, `expected native delete rejection, got ${nativeDelete.status}`)
  const stillThere = await getRecord('users', target.id)
  assert.equal(stillThere.status, 200)

  const deleted = await api('POST', '/api/v1', { token: adminToken, body: { action: 'delete_user', user_id: target.id } })
  assert.equal(deleted.status, 200)
  assert.equal(deleted.data?.deleted, true)
  assert.equal(deleted.data?.counts?.transferred?.tasks, 1)
  assert.equal(deleted.data?.counts?.transferred?.items, 1)
  assert.equal(deleted.data?.counts?.transferred?.notes, 1)
  assert.equal(deleted.data?.counts?.transferred?.labels, 1)
  assert.equal(deleted.data?.counts?.transferred?.shops, 1)
  assert.equal(deleted.data?.counts?.cascaded_private?.tasks, 1, 'private task must be counted as cascaded, not transferred')
  assert.equal(deleted.data?.counts?.cleared?.['tasks.assigned_to'], 1)
  assert.equal(deleted.data?.counts?.cleared?.['tasks.completed_by'], 1)
  assert.equal(deleted.data?.counts?.cleared?.['items.assigned_to'], 1)
  assert.equal(deleted.data?.counts?.cleared?.['notes.assigned_to'], 1)

  const gone = await getRecord('users', target.id)
  assert.equal(gone.status, 404)

  const privateTaskAfter = await getRecord('tasks', privateTask.data.id)
  assert.equal(privateTaskAfter.status, 404, 'private task must not survive under the admin')

  const taskAfter = await getRecord('tasks', task.data.id)
  assert.equal(taskAfter.status, 200)
  assert.equal(taskAfter.data?.user, admin.id)
  assert.ok(!taskAfter.data?.assigned_to, 'task assigned_to should be cleared')
  assert.ok(!taskAfter.data?.completed_by, 'task completed_by should be cleared')

  const itemAfter = await getRecord('items', item.data.id)
  assert.equal(itemAfter.status, 200)
  assert.equal(itemAfter.data?.user, admin.id)
  assert.ok(!itemAfter.data?.assigned_to, 'item assigned_to should be cleared')

  const noteAfter = await getRecord('notes', note.data.id)
  assert.equal(noteAfter.status, 200)
  assert.equal(noteAfter.data?.user, admin.id)
  assert.ok(!noteAfter.data?.assigned_to, 'note assigned_to should be cleared')

  const labelAfter = await getRecord('labels', label.data.id)
  assert.equal(labelAfter.status, 200)
  assert.equal(labelAfter.data?.user, admin.id)
  assert.equal(labelAfter.data?.owner, admin.id)
  assert.ok(!(labelAfter.data?.shared_with || []).includes(target.id), 'label shared_with should drop deleted member')

  const shopAfter = await getRecord('shops', shop.data.id)
  assert.equal(shopAfter.status, 200)
  assert.equal(shopAfter.data?.user, admin.id)
})

// --- 7. Complete a recurring task -------------------------------------
test('recurring task can be created and completed (api/v1 complete)', async () => {
  const rec = await api('POST', '/api/collections/tasks/records', {
    token: adminToken,
    body: { title: 'Smoke recurring task', repeat_interval: 'day', status: 'todo', user: admin.id },
  })
  assert.equal(rec.status, 200)
  assert.equal(rec.data?.repeat_interval, 'day')

  const done = await api('POST', '/api/v1', {
    token: adminToken, body: { action: 'complete', type: 'task', id: rec.data?.id },
  })
  assert.equal(done.status, 200)
  assert.equal(done.data?.completed, true)

  const after = await api('GET', `/api/collections/tasks/records/${rec.data?.id}`, { token: adminToken })
  assert.equal(after.data?.status, 'done')
  assert.equal(after.data?.repeat_interval, 'day', 'repeat_interval must survive completion')
  // NOTE: generating the NEXT occurrence is the hourly cron's job — see GH#7
  // (t_gh3654983b): pb_hooks/cron/recurring-tasks.js is in a subdir, never loaded.
})

// --- 7b. /api/v1 update action -----------------------------------------
test('v1 update action updates title/status/due_date on a task', async () => {
  const created = await api('POST', '/api/v1', {
    token: adminToken,
    body: { action: 'create', type: 'task', title: 'Smoke update me', status: 'todo' },
  })
  assert.equal(created.status, 201)
  assert.ok(created.data?.id, 'expected created task id')

  const upd = await api('POST', '/api/v1', {
    token: adminToken,
    body: {
      action: 'update', type: 'task', id: created.data.id,
      title: 'Smoke updated title', status: 'backlog', due_date: '2026-12-01T09:00:00.000Z',
    },
  })
  assert.equal(upd.status, 200)
  assert.equal(upd.data?.updated, true)
  assert.deepEqual((upd.data?.changed || []).slice().sort(), ['due_date', 'status', 'title'])

  const after = await api('GET', `/api/collections/tasks/records/${created.data.id}`, { token: adminToken })
  assert.equal(after.data?.title, 'Smoke updated title')
  assert.equal(after.data?.status, 'backlog')
  assert.equal(new Date(after.data?.due_date).toISOString(), '2026-12-01T09:00:00.000Z')
})

// --- 8. ICS export -----------------------------------------------------
test('ICS export returns a valid VCALENDAR envelope', async () => {
  const r = await api('GET', '/api/ics-export', { token: adminToken })
  assert.equal(r.status, 200)
  const text = typeof r.data === 'string' ? r.data : JSON.stringify(r.data)
  assert.ok(text.includes('BEGIN:VCALENDAR'), 'expected VCALENDAR envelope')
  assert.ok(text.includes('VERSION:2.0'), 'expected ICAL version')
})

test('ICS export includes the due-date task as a VEVENT', { todo: 'ICS export drops due tasks — GH#12 (t_gh246847d0)' }, async () => {
  const r = await api('GET', '/api/ics-export', { token: adminToken })
  const text = typeof r.data === 'string' ? r.data : JSON.stringify(r.data)
  assert.ok(text.includes('VEVENT'), 'expected at least one VEVENT')
})

// --- 9. Password change ------------------------------------------------
test('member can change their password (PATCH with oldPassword)', async () => {
  const r = await api('PATCH', `/api/collections/users/records/${member.id}`, {
    token: memberToken,
    body: { oldPassword: 'password123', password: 'newpassword123', passwordConfirm: 'newpassword123' },
  })
  assert.equal(r.status, 200)
})

test('member authenticates with the new password', async () => {
  const a = await auth('member@smoke.test', 'newpassword123')
  assert.ok(a.token, 'expected token with new password')
  memberToken = a.token
})

// --- 10. Companion register --------------------------------------------
test('companion device registration succeeds', { todo: 'companion 500 ReferenceError — GH#8 (t_gh41a39209)' }, async () => {
  const r = await api('POST', '/api/companion/devices/register', {
    token: memberToken,
    body: { deviceId: 'smoke-device-1', deviceName: 'Smoke Phone', platform: 'ios', osVersion: '18', appVersion: '0.3.0' },
  })
  assert.ok(r.status === 201 || r.status === 200, `expected 2xx, got ${r.status}`)
})

// --- 11. OpenAPI paths vs registered routes (GH#65 parity gate) --------
// The documented spec (GET /api/openapi.json) must match the routes that are
// actually registered by the repo's hooks. Two independent sources of truth:
//   1. Hook registry: routes exported by the hooks (routerAdd/routerGet/... in
//      the auto-loaded pb_hooks/*.pb.js files) plus PocketBase-native CRUD
//      (the spec deliberately documents the generic /collections/{collection}
//      /records surface) — every documented path must be registered and every
//      hook-registered route must be documented (vice versa).
//   2. Live probe: every documented path must ANSWER on the live server (any
//      status except 404 proves the route pattern exists; 404 means the route
//      is NOT registered). Placeholder params probe the route pattern, not a
//      specific record; PB-native {collection}/records/{id} is probed via its
//      parent list route because a missing record id legitimately 404s.
// This gate catches the historical drift where the spec documented a
// fictitious /todoless/* tree that 404'd on every operation (DEF-API-001).

// PocketBase auto-registers these native collection CRUD routes (not via hooks),
// with these HTTP methods (PB 0.35 core API).
const PB_NATIVE_METHODS = {
  '/api/collections/{collection}/records': ['get', 'post'],
  '/api/collections/{collection}/records/{id}': ['get', 'patch', 'delete'],
}
const PB_NATIVE_PATHS = Object.keys(PB_NATIVE_METHODS)

// HTTP methods the parity gate tracks. routerAdd accepts arbitrary method tokens;
// 'ANY' is a router helper for all standard methods, not a real HTTP method.
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options'])

// Normalize a route path for comparison: PB echo uses :param and {param} forms.
function normPath(p) {
  return p.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '{$1}')
}

// Routes registered by the repo's hooks: scan the auto-loaded pb_hooks/*.pb.js
// files (PocketBase loads exactly these — top-level *.pb.js — nothing else) for
// routerAdd('METHOD','/path'), routerGet('/path'), routerPost('/path'), etc.
// Returns Map<full path, Set<http method>>.
function hookRegistered() {
  const hooksDir = fileURLToPath(new URL('../../pb_hooks', import.meta.url))
  const routes = new Map()
  const reAdd = /routerAdd\(\s*['"]([A-Za-z]+)['"]\s*,\s*['"]([^'"]+)['"]/g
  const reVerb = /router(Get|Post|Put|Patch|Delete|Any|Head|Options)\(\s*['"]([^'"]+)['"]/g
  for (const f of readdirSync(hooksDir).filter((f) => f.endsWith('.pb.js'))) {
    const src = readFileSync(new URL(`../../pb_hooks/${f}`, import.meta.url), 'utf8')
    let m
    while ((m = reAdd.exec(src))) {
      const method = m[1].toLowerCase()
      if (!HTTP_METHODS.has(method)) continue
      const path = normPath(m[2])
      if (!routes.has(path)) routes.set(path, new Set())
      routes.get(path).add(method)
    }
    while ((m = reVerb.exec(src))) {
      const method = m[1].toLowerCase()
      if (!HTTP_METHODS.has(method)) continue
      const path = normPath(m[2])
      if (!routes.has(path)) routes.set(path, new Set())
      routes.get(path).add(method)
    }
  }
  return routes
}

// Resolve a documented spec path to the absolute URL path the server serves it
// at, using the spec's first server URL as the base (e.g. "/api").
function resolveSpecPath(spec, p) {
  const base = spec.servers?.[0]?.url?.replace(/\/+$/, '') || '/api'
  return normPath((base.startsWith('http') ? new URL(base).pathname.replace(/\/+$/, '') : base) + p)
}

// Build a URL that hits the documented route pattern rather than a specific
// record: path params become placeholder values ({collection} -> a real
// collection so PB-native list routes answer).
function probeUrlFor(full) {
  return full.replace(/\{collection\}/g, 'tasks').replace(/\{[^}]+?\}/g, '__probe__')
}

test('openapi.json serves a valid spec with paths', async () => {
  const r = await api('GET', '/api/openapi.json')
  assert.equal(r.status, 200)
  assert.ok(r.data?.openapi, 'expected openapi version')
  assert.ok(r.data?.paths && Object.keys(r.data.paths).length > 0, 'expected documented paths')
})

test('every documented OpenAPI path is registered (GH#65)', async () => {
  const r = await api('GET', '/api/openapi.json')
  assert.equal(r.status, 200)
  const spec = r.data
  const paths = Object.keys(spec?.paths || {})
  assert.ok(paths.length > 0, 'expected documented paths')

  // Static: every documented path must be registered by a hook or by PB-native
  // collection CRUD, and every documented method must be registered for it.
  const registered = hookRegistered()
  const missing = []        // path not registered at all
  const missingMethod = []  // path registered, but a documented method is not
  for (const p of paths) {
    const full = resolveSpecPath(spec, p)
    const methods = Object.keys(spec.paths[p]).filter((k) => HTTP_METHODS.has(k.toLowerCase()))
    const nativeMethods = PB_NATIVE_METHODS[full]
    const hookMethods = registered.get(full)
    if (!nativeMethods && !hookMethods) {
      missing.push(`${p} (served at ${full})`)
      continue
    }
    const registeredMethods = nativeMethods || [...hookMethods]
    for (const k of methods) {
      if (!registeredMethods.includes(k.toLowerCase())) {
        missingMethod.push(`${k.toUpperCase()} ${full} — hook registers: ${(hookMethods ? [...hookMethods].sort().join(',') : 'PB-native only')}`)
      }
    }
  }
  assert.deepEqual(missing, [], 'documented OpenAPI paths that are NOT registered (missing from hooks or PB-native CRUD)')
  assert.deepEqual(missingMethod, [], 'documented OpenAPI methods that are NOT registered for an existing path')

  // Live probe: every documented method of every documented path must ANSWER on
  // the live server. Any status except 404 proves the route pattern exists
  // (401/400/500 still mean "registered"); 404 means the route is NOT there.
  const failures = []
  for (const p of paths) {
    const full = resolveSpecPath(spec, p)
    const methods = Object.keys(spec.paths[p]).filter((k) => HTTP_METHODS.has(k.toLowerCase()))
    for (const k of methods) {
      const method = k.toUpperCase()
      let url = probeUrlFor(full)
      // PB-native item route: probe the parent list route (a missing record id
      // legitimately 404s regardless of whether the route is registered).
      if (full === '/api/collections/{collection}/records/{id}') {
        if (method !== 'GET') continue
        url = '/api/collections/tasks/records'
      }
      const res = await fetch(BASE + url, { method, headers: { Accept: '*/*' } })
      if (res.status === 404) failures.push(`${method} ${url} -> 404`)
    }
  }
  assert.deepEqual(failures, [], 'documented OpenAPI paths/methods that answered 404 on the live server')
})

test('every hook-registered route is documented (GH#65, vice versa)', async () => {
  const r = await api('GET', '/api/openapi.json')
  assert.equal(r.status, 200)
  const documented = new Map()
  for (const [p, item] of Object.entries(r.data?.paths || {})) {
    documented.set(
      resolveSpecPath(r.data, p),
      new Set(Object.keys(item).filter((k) => HTTP_METHODS.has(k.toLowerCase())).map((k) => k.toLowerCase())),
    )
  }
  const registered = hookRegistered()
  const missingPath = []    // hook route not documented at all
  const missingMethod = []  // hook route documented, but a hook method is not
  for (const [rp, methods] of registered) {
    if (PB_NATIVE_METHODS[rp]) continue // PB-native generic surface is not a hook route
    const docMethods = documented.get(rp)
    if (!docMethods) {
      missingPath.push(rp)
      continue
    }
    for (const meth of methods) {
      if (!docMethods.has(meth)) missingMethod.push(`${meth.toUpperCase()} ${rp}`)
    }
  }
  assert.deepEqual(missingPath, [], 'hook-registered routes that are NOT documented in /api/openapi.json')
  assert.deepEqual(missingMethod, [], 'hook-registered methods that are NOT documented for an existing path')
})
test('docs page (GET /api/docs) references only vendored swagger-ui assets', async () => {
  const r = await api('GET', '/api/docs')
  assert.equal(r.status, 200)
  const html = typeof r.data === 'string' ? r.data : ''
  assert.ok(html.includes('swagger-ui'), 'expected Swagger UI page')
  assert.ok(!html.includes('jsdelivr'), 'docs page must not load from a CDN (GH#64)')
  assert.ok(!html.includes('cdn.jsdelivr.net'), 'docs page must not reference cdn.jsdelivr.net (GH#64)')
  assert.ok(html.includes('/docs/swagger-ui/swagger-ui.css'), 'expected vendored swagger-ui.css')
  assert.ok(html.includes('/docs/swagger-ui/swagger-ui-bundle.js'), 'expected vendored swagger-ui-bundle.js')
  assert.ok(html.includes('/docs/swagger-ui/swagger-ui-standalone-preset.js'), 'expected vendored swagger-ui-standalone-preset.js')
  assert.ok(html.includes('/docs/swagger-ui/swagger-ui-init.js'), 'expected vendored swagger-ui-init.js')
  // No inline script: the bootstrap lives in swagger-ui-init.js (same-origin,
  // allowed by CSP script-src 'self'). Inline scripts would need 'unsafe-inline'.
  assert.ok(!html.includes('SwaggerUIBundle({'), 'docs page must not inline the SwaggerUIBundle init (GH#64)')
  assert.ok(!html.includes('SwaggerUIBundle.SwaggerUIStandalonePreset'), 'must not reference missing SwaggerUIBundle.SwaggerUIStandalonePreset')
})

test('vendored swagger-ui-init.js is self-contained and external-call-free (GH#64)', () => {
  const init = readFileSync(new URL('../../public/docs/swagger-ui/swagger-ui-init.js', import.meta.url), 'utf8')
  assert.ok(init.includes('SwaggerUIBundle({'), 'expected SwaggerUIBundle init')
  // Standalone preset global (not SwaggerUIBundle.*, which does not exist)
  assert.ok(init.includes('SwaggerUIStandalonePreset'), 'expected global SwaggerUIStandalonePreset reference')
  assert.ok(!init.includes('SwaggerUIBundle.SwaggerUIStandalonePreset'), 'must not reference missing SwaggerUIBundle.SwaggerUIStandalonePreset')
  // No external validator call / no outbound URLs (air-gapped LAN safe)
  assert.ok(init.includes('validatorUrl: null'), 'expected validatorUrl: null to disable external validation')
  const externalUrls = init.match(/https?:\/\//g) || []
  assert.equal(externalUrls.length, 0, `init must contain no external URLs (found ${externalUrls.length})`)
})

// --- 12. Agent API key last_used_at is throttled (GH#29) ----------------
// authFromApiKey() must NOT write the agent_keys record on every request:
// a polling integration would otherwise cause one SQLite write per poll.
// Rapid successive authenticated requests must not advance last_used_at.
// (The >60s elapse path is covered by scripts/verify-gh29-throttle.py, which
// backdates the DB row and asserts the next request advances it.)
test('agent key last_used_at is throttled on repeated auth-test calls (GH#29)', async () => {
  assert.ok(adminToken, 'expected admin session from earlier bootstrap')

  const created = await api('POST', '/api/agent/keys', {
    token: adminToken,
    body: { name: 'smoke-throttle', scopes: ['entries:read'] },
  })
  assert.equal(created.status, 201, 'agent key create should succeed')
  const rawKey = created.data?.key
  const keyId = created.data?.id
  assert.ok(rawKey, 'expected raw key on creation')

  async function listLastUsed() {
    const r = await api('GET', '/api/agent/keys', { token: adminToken })
    assert.equal(r.status, 200)
    const found = (r.data || []).find((k) => k.id === keyId)
    assert.ok(found, 'created key should appear in key list')
    return found.last_used_at
  }

  // First authenticated request writes the initial timestamp.
  const first = await api('GET', '/api/agent/auth-test', { token: rawKey })
  assert.equal(first.status, 200)
  assert.equal(first.data?.authenticated, true)

  // DB commit is synchronous in PB hooks; read it back.
  const t1 = await listLastUsed()
  assert.ok(t1, 'expected last_used_at after first authenticated request')

  // Rapid follow-up requests must NOT advance the timestamp (throttle).
  const second = await api('GET', '/api/agent/auth-test', { token: rawKey })
  assert.equal(second.status, 200)
  const t2 = await listLastUsed()
  assert.equal(t2, t1, 'last_used_at must not advance on a request within the 60s throttle window')

  const third = await api('GET', '/api/agent/auth-test', { token: rawKey })
  assert.equal(third.status, 200)
  const t3 = await listLastUsed()
  assert.equal(t3, t1, 'last_used_at must still be unchanged on the third rapid request')
})

// --- 13. GH#22: agent keys survive a single-admin demotion ---------------
// A family has exactly one admin. That admin mints an agent key, then the
// family's admin role is transferred to a second member (set_role promotes
// the new admin and demotes the old one, per main.pb.js's single-admin
// invariant). The NEW admin must still be able to list and revoke the key
// the FORMER admin created — before the GH#22 fix both routes filtered
// strictly on `user = auth.id`, so the key became permanently invisible and
// un-revocable to every admin the family ever has afterwards.
test('new admin can list and revoke agent keys created by a demoted former admin (GH#22)', async () => {
  const successor = await registerDisposableMember('gh22-successor@smoke.test', 'GH22 Successor')
  const successorToken = successor.token

  // Former admin (top-level `admin`/`adminToken`) mints a key while still admin.
  const created = await api('POST', '/api/agent/keys', {
    token: adminToken,
    body: { name: 'gh22-legacy-key', scopes: ['entries:read'] },
  })
  assert.equal(created.status, 201, 'former admin should be able to create the key')
  const legacyKeyId = created.data?.id
  assert.ok(legacyKeyId, 'expected created key id')

  // Transfer admin: promoting the successor demotes the current admin
  // (single-admin-per-family invariant enforced by /api/v1 set_role).
  const promote = await api('POST', '/api/v1', {
    token: adminToken,
    body: { action: 'set_role', user_id: successor.user.id, role: 'admin' },
  })
  assert.equal(promote.status, 200, 'admin transfer should succeed')
  assert.equal(promote.data?.role, 'admin')

  // Former admin lost the admin role and can no longer call admin-only routes.
  const formerAdminList = await api('GET', '/api/agent/keys', { token: adminToken })
  assert.equal(formerAdminList.status, 403, 'demoted former admin must lose admin-only access')

  // New admin must see the legacy key in the family-scoped list.
  const successorList = await api('GET', '/api/agent/keys', { token: successorToken })
  assert.equal(successorList.status, 200)
  const found = (successorList.data || []).find((k) => k.id === legacyKeyId)
  assert.ok(found, 'new admin must see the former admin\'s agent key in the list')

  // New admin must be able to revoke the legacy key.
  const revoke = await api('POST', `/api/agent/keys/${legacyKeyId}/revoke`, { token: successorToken })
  assert.equal(revoke.status, 200, 'new admin must be able to revoke the former admin\'s key')
  assert.equal(revoke.data?.active, false)

  const afterRevoke = await api('GET', '/api/agent/keys', { token: successorToken })
  assert.equal(afterRevoke.status, 200)
  const revoked = (afterRevoke.data || []).find((k) => k.id === legacyKeyId)
  assert.ok(revoked, 'revoked key should still be listed')
  assert.equal(revoked.active, false)
})
