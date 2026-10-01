// #39: data seeded on the PREVIOUS release must survive an upgrade to the
// current migrations/hooks. Driven by scripts/test-migration-upgrade.sh:
//   node tests/upgrade/upgrade-check.mjs seed   <stateFile>   (old release running)
//   node tests/upgrade/upgrade-check.mjs verify <stateFile>   (current code running)
// Uses only APIs that existed in the previous release (public register/invite
// routes and the native collection API).
import assert from 'node:assert/strict'
import fs from 'node:fs'

const BASE = process.env.PB_URL || 'http://127.0.0.1:8090'
const [phase, stateFile] = process.argv.slice(2)
const PASSWORD = 'Upgrade-Passw0rd!'

async function api(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, data }
}
const login = async (email) => {
  const r = await api('POST', '/api/collections/users/auth-with-password', { body: { identity: email, password: PASSWORD } })
  assert.equal(r.status, 200, `login ${email}: ${JSON.stringify(r.data)}`)
  return { token: r.data.token, record: r.data.record }
}
const titles = (list) => (list.items || []).map((r) => r.title).sort()

async function seed() {
  const reg = await api('POST', '/api/register', {
    body: { email: 'upgrade-admin@example.com', password: PASSWORD, passwordConfirm: PASSWORD, name: 'Upgrade Admin', family_name: 'Upgrade Family', user_type: 'family_member', language: 'en' },
  })
  assert.equal(reg.status, 201, `register admin: ${JSON.stringify(reg.data)}`)
  const admin = await login('upgrade-admin@example.com')
  const invite = await api('POST', '/api/invites/create', { token: admin.token, body: { type: 'human' } })
  assert.equal(invite.status, 201, `invite: ${JSON.stringify(invite.data)}`)
  const memberReg = await api('POST', '/api/register', {
    body: { email: 'upgrade-member@example.com', password: PASSWORD, passwordConfirm: PASSWORD, name: 'Upgrade Member', invite_code: invite.data.code, user_type: 'family_member', language: 'en' },
  })
  assert.equal(memberReg.status, 201, `register member: ${JSON.stringify(memberReg.data)}`)

  const create = async (collection, body) => {
    const r = await api('POST', `/api/collections/${collection}/records`, { token: admin.token, body })
    assert.equal(r.status, 200, `${collection}: ${JSON.stringify(r.data)}`)
    return r.data
  }
  const label = await create('labels', { name: 'Upgrade label', color: '#8b5cf6', visibility: 'family', owner: admin.record.id, user: admin.record.id, family: admin.record.family_id })
  await create('shops', { name: 'Upgrade shop', color: '#ec4899', user: admin.record.id })
  await create('tasks', { title: 'Upgrade shared', status: 'todo', is_private: false, user: admin.record.id, due_date: '2026-11-01 09:00:00.000Z', blocked_comment: 'Upgrade note' })
  await create('tasks', { title: 'Upgrade private', status: 'todo', is_private: true, user: admin.record.id })
  await create('tasks', { title: 'Upgrade labelled', status: 'todo', is_private: false, user: admin.record.id, label: [label.id], labels: [label.id] })
  await create('tasks', { title: 'Upgrade recurring', status: 'todo', is_private: false, user: admin.record.id, repeat_interval: 'week', due_date: '2026-11-02 09:00:00.000Z' })
  await create('items', { title: 'Upgrade milk', quantity: 2, user: admin.record.id })

  const memberView = await api('GET', '/api/collections/tasks/records?perPage=200', { token: (await login('upgrade-member@example.com')).token })
  fs.writeFileSync(stateFile, JSON.stringify({ familyId: admin.record.family_id, labelId: label.id, memberTasks: titles(memberView.data) }, null, 2))
  console.log('[upgrade] seeded previous-release data')
}

async function verify() {
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
  const admin = await login('upgrade-admin@example.com')
  const member = await login('upgrade-member@example.com')
  assert.equal(admin.record.family_id, state.familyId)
  assert.equal(member.record.family_id, state.familyId, 'member still in the same family')
  assert.equal(admin.record.role, 'admin')

  const adminTasks = await api('GET', '/api/collections/tasks/records?perPage=200', { token: admin.token })
  assert.equal(adminTasks.status, 200)
  assert.deepEqual(titles(adminTasks.data), ['Upgrade labelled', 'Upgrade private', 'Upgrade recurring', 'Upgrade shared'])
  const labelled = adminTasks.data.items.find((t) => t.title === 'Upgrade labelled')
  assert.ok((labelled.label || []).includes(state.labelId), 'canonical label relation preserved')
  // #224 (z072): the app note was copied into the calendar description field.
  const shared = adminTasks.data.items.find((t) => t.title === 'Upgrade shared')
  assert.equal(shared.blocked_comment, 'Upgrade note')
  assert.equal(shared.description, 'Upgrade note', 'z072 backfilled description from blocked_comment')

  const memberTasks = await api('GET', '/api/collections/tasks/records?perPage=200', { token: member.token })
  assert.deepEqual(titles(memberTasks.data), state.memberTasks, "member's visible tasks unchanged by the upgrade")
  assert.ok(!titles(memberTasks.data).includes('Upgrade private'), 'private task still hidden from the member')

  for (const [collection, title] of [['items', 'Upgrade milk'], ['shops', 'Upgrade shop'], ['labels', 'Upgrade label']]) {
    const r = await api('GET', `/api/collections/${collection}/records?perPage=200`, { token: admin.token })
    assert.equal(r.status, 200, collection)
    assert.ok(r.data.items.some((x) => (x.title || x.name) === title), `${collection} kept ${title}`)
  }

  // Current-release behaviour works on the upgraded data.
  const boot = await api('GET', '/api/bootstrap', { token: admin.token })
  assert.equal(boot.status, 200, 'bootstrap on upgraded data')
  const entries = await api('GET', '/api/entries?page=1&perPage=50', { token: member.token })
  assert.equal(entries.status, 200)
  assert.ok(entries.data.totalItems >= 3)
  const recurring = adminTasks.data.items.find((t) => t.title === 'Upgrade recurring')
  const done = await api('PATCH', `/api/collections/tasks/records/${recurring.id}`, { token: admin.token, body: { status: 'done' } })
  assert.equal(done.status, 200)
  const after = await api('GET', `/api/collections/tasks/records?perPage=200&filter=${encodeURIComponent('title = "Upgrade recurring" && status = "todo"')}`, { token: admin.token })
  assert.equal(after.data.items.length, 1, 'completing an upgraded recurring task creates the next occurrence')
  console.log('[upgrade] previous-release data verified on the current release')
}

if (phase === 'seed') await seed()
else if (phase === 'verify') await verify()
else throw new Error('usage: upgrade-check.mjs seed|verify <stateFile>')
