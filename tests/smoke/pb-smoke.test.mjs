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
//   - OpenAPI path parity  -> GH#65 (t_ghcaa58e6a)
//
// Env: PB_URL (default http://127.0.0.1:8090)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

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
test('pb is reachable: health, version, hook-health', async () => {
  const health = await api('GET', '/api/health')
  assert.equal(health.status, 200)

  const version = await api('GET', '/api/version')
  assert.equal(version.status, 200)
  assert.equal(version.data?.pb, '0.35.1')

  const hook = await api('GET', '/api/hook-health')
  assert.equal(hook.status, 200)
  assert.equal(hook.data?.ok, true)
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

// --- 11. OpenAPI paths vs registered routes ----------------------------
test('openapi.json serves a valid spec with paths', async () => {
  const r = await api('GET', '/api/openapi.json')
  assert.equal(r.status, 200)
  assert.ok(r.data?.openapi, 'expected openapi version')
  assert.ok(r.data?.paths && Object.keys(r.data.paths).length > 0, 'expected documented paths')
})

// --- 12. Docs page is fully vendored (GH#64) --------------------------------
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

test('every documented OpenAPI path is registered on the live server', { todo: 'OpenAPI path parity — GH#65 (t_ghcaa58e6a)' }, async () => {
  const r = await api('GET', '/api/openapi.json')
  assert.equal(r.status, 200)
  const paths = Object.keys(r.data?.paths || {})
  assert.ok(paths.length > 0, 'expected documented paths')
  for (const p of paths.slice(0, 20)) {
    const res = await fetch(BASE + p, { method: 'GET', headers: { Authorization: `Bearer ${adminToken}` } })
    assert.notEqual(res.status, 404, `documented path ${p} must be registered (got ${res.status})`)
  }
})