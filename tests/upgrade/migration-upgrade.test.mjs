// GH#39 — Migration upgrade survival suite (HTTP).
//
// Runs against the UPGRADED instance produced by scripts/pb-migration-upgrade.sh:
// the snapshot from the previous release (seeded with 1 admin user, 1 task,
// 1 grocery item, 1 note) is booted with the CURRENT pb_migrations + pb_hooks.
// These tests prove the seeded data is still reachable through the API after
// the upgrade — the schema/rules assertions live in the bash script (state
// parity fresh-vs-upgraded via sqlite).
//
// The suite only runs when MIG_UPGRADE=1 (set by the script), so plain
// `node --test tests/upgrade/` against any other instance skips cleanly.
//
// Env: PB_URL (default http://127.0.0.1:8095), MIG_UPGRADE=1
import test from 'node:test'
import assert from 'node:assert/strict'

const BASE = process.env.PB_URL || 'http://127.0.0.1:8095'
const ENABLED = process.env.MIG_UPGRADE === '1'
// The script exports the PB version it actually launched (PB_VERSION).
const EXPECTED_PB = process.env.PB_VERSION || '0.35.1'

async function api(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, data }
}

test('upgraded instance is healthy and reports the pinned PB version', { skip: !ENABLED }, async () => {
  const health = await api('GET', '/api/health')
  assert.equal(health.status, 200)
  const version = await api('GET', '/api/version')
  assert.equal(version.status, 200)
  assert.equal(version.data?.pb, EXPECTED_PB)
  const hook = await api('GET', '/api/hook-health')
  assert.equal(hook.status, 200)
  assert.equal(hook.data?.ok, true)
})

test('setup-status still reports an existing installation after upgrade', { skip: !ENABLED }, async () => {
  const r = await api('GET', '/api/setup-status')
  assert.equal(r.status, 200)
  assert.equal(r.data?.has_users, true, 'pre-upgrade users must survive the upgrade')
  assert.equal(r.data?.setup_complete, true)
})

test('pre-upgrade admin can still authenticate', { skip: !ENABLED }, async () => {
  const r = await api('POST', '/api/collections/users/auth-with-password', {
    body: { identity: 'migration.upgrade@test.local', password: 'migration-upgrade-123' },
  })
  assert.equal(r.status, 200)
  assert.ok(r.data?.token, 'expected auth token after upgrade')
  assert.equal(r.data?.record?.name, 'Migration Admin')
})

test('pre-upgrade task is still visible', { skip: !ENABLED }, async () => {
  const r = await api('POST', '/api/collections/users/auth-with-password', {
    body: { identity: 'migration.upgrade@test.local', password: 'migration-upgrade-123' },
  })
  const token = r.data?.token
  assert.ok(token, 'expected auth token')
  const list = await api('GET', '/api/collections/tasks/records?perPage=100', { token })
  assert.equal(list.status, 200)
  const titles = (list.data?.items || []).map((t) => t.title)
  assert.ok(titles.includes('Pre-existing upgrade task'), `task vanished after upgrade (got ${titles})`)
})

test('pre-upgrade grocery item is still visible', { skip: !ENABLED }, async () => {
  const r = await api('POST', '/api/collections/users/auth-with-password', {
    body: { identity: 'migration.upgrade@test.local', password: 'migration-upgrade-123' },
  })
  const token = r.data?.token
  assert.ok(token, 'expected auth token')
  const list = await api('GET', '/api/collections/items/records?perPage=100', { token })
  assert.equal(list.status, 200)
  const titles = (list.data?.items || []).map((i) => i.title)
  assert.ok(titles.includes('Melk'), `grocery item vanished after upgrade (got ${titles})`)
})

test('pre-upgrade note is still visible', { skip: !ENABLED }, async () => {
  const r = await api('POST', '/api/collections/users/auth-with-password', {
    body: { identity: 'migration.upgrade@test.local', password: 'migration-upgrade-123' },
  })
  const token = r.data?.token
  assert.ok(token, 'expected auth token')
  const list = await api('GET', '/api/collections/notes/records?perPage=100', { token })
  assert.equal(list.status, 200)
  const titles = (list.data?.items || []).map((n) => n.title)
  assert.ok(titles.includes('Pre-existing upgrade note'), `note vanished after upgrade (got ${titles})`)
})