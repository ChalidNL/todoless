import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const root = new URL('../', import.meta.url)
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8')

function fieldSet(initial = []) {
  const values = new Map(initial.map((field) => [field.name, field]))
  return {
    getByName: (name) => values.get(name),
    add: (field) => values.set(field.name, field),
    remove: () => {},
  }
}

function executeMigration({ taskRecords = [], labelRecords = [] } = {}) {
  let up
  const relationFields = []
  const collections = {
    users: { id: 'users', fields: fieldSet() },
    families: { id: 'families', fields: fieldSet() },
    labels: { id: 'labels', fields: fieldSet([
      { name: 'visibility' }, { name: 'owner' }, { name: 'shared_with' }, { name: 'family' },
    ]) },
    tasks: { id: 'tasks', fields: fieldSet() },
  }
  class RelationField {
    constructor(options) {
      Object.assign(this, options)
      relationFields.push(this)
    }
  }
  const app = {
    findCollectionByNameOrId: (name) => collections[name],
    findRecordsByFilter: (name) => name === 'tasks' ? taskRecords : labelRecords,
    findRecordById: (name, id) => {
      if (name === 'labels' && labelRecords.some((record) => record.id === id)) return { id }
      if (name === 'users') return { get: () => 'family-a' }
      throw new Error('missing record')
    },
    save: () => {},
  }
  const sandbox = {
    migrate: (forward) => { up = forward },
    RelationField,
    SelectField: class { constructor(options) { Object.assign(this, options) } },
  }
  vm.createContext(sandbox)
  vm.runInContext(read('pb_migrations/z061_label_visibility.js'), sandbox)
  up(app)
  return { collections, relationFields }
}

function fakeRecord(values) {
  return {
    ...values,
    get(name) { return this[name] },
    set(name, value) { this[name] = value; return this },
  }
}

test('task rules keep legacy private tasks owner-only and label rules hide private labels', () => {
  const { collections } = executeMigration()
  const taskRule = collections.tasks.listRule
  const labelRule = collections.labels.listRule

  assert.match(taskRule, /user = @request\.auth\.id/)
  assert.match(taskRule, /is_private = false/)
  assert.match(taskRule, /user\.family_id = @request\.auth\.family_id/)
  assert.match(taskRule, /label\.family:each = @request\.auth\.family_id/)
  assert.match(labelRule, /visibility = "private"/)
  assert.match(labelRule, /owner = @request\.auth\.id/)
  assert.doesNotMatch(labelRule, /^family = @request\.auth\.family_id \|\|/)
})

test('migration makes canonical label relation multi-select and backfills every valid legacy label', () => {
  const task = fakeRecord({ labels: ['label-a', 'label-b'], label: '' })
  const labels = [fakeRecord({ id: 'label-a' }), fakeRecord({ id: 'label-b' })]
  const { relationFields } = executeMigration({ taskRecords: [task], labelRecords: labels })
  const taskLabelField = relationFields.find((field) => field.name === 'label')

  assert.equal(taskLabelField.maxSelect, 99)
  assert.deepEqual(Array.from(task.label), ['label-a', 'label-b'])
})

test('live task visibility enforcement keeps private tasks and hidden labels away from non-owners', () => {
  const authLib = read('pb_hooks/lib/auth.js')
  const bootstrap = read('pb_hooks/16_bootstrap.pb.js')

  // canAccessTaskForUser (lib/auth.js, GH#30) is the single live gate that
  // enforces is_private and per-label visibility. It replaces the dead
  // routes/tasks.js rules removed in GH#31.
  assert.match(authLib, /function canAccessTaskForUser\(/)
  assert.match(authLib, /record\.get\('is_private'\) === true/)
  assert.match(authLib, /visibility === 'private' && labelOwner !== userId/)
  assert.match(authLib, /visibility === 'shared'/)
  // The bootstrap route re-applies the same gate over family-scoped fetches.
  assert.match(bootstrap, /canAccessTaskForUser\(r, auth\)/)
})

test('record hooks write every label into the canonical relation on create and update', () => {
  const main = read('pb_hooks/main.pb.js')
  const authLib = read('pb_hooks/lib/auth.js')

  // Live canonical label write on create (main.pb.js onRecordCreate) and
  // update (onRecordUpdate), replacing the dead routes/tasks.js dual-write.
  // On update the relation (`label`) is canonical and mirrored into the legacy
  // `labels` JSON field; a legacy write to `labels` alone is mirrored back.
  // Behaviour is exercised in tests/main-pb-task-date-sync.test.mjs.
  assert.match(main, /rec\.set\('labels', createLabels\)/)
  assert.match(main, /rec\.set\('label', createLabels\)/)
  assert.match(main, /rec\.set\('labels', newLabel\)/)
  assert.match(main, /rec\.set\('label', newLabels\)/)
  // No first-label-only truncation in any live canonical write.
  assert.doesNotMatch(main, /labels\s*\[0\]/)
  assert.doesNotMatch(authLib, /labels\s*\[0\]/)
  assert.match(authLib, /function setCanonicalTaskLabels\(/)
  assert.match(authLib, /record\.set\('label', ids\)/)
})

test('task list route binds filter inputs and allow-lists sort fields', () => {
  // Live equivalent of the dead routes/tasks.js list route (removed in GH#31):
  // the agent task list in 03_agent_tasks.pb.js binds status via {:status} and
  // falls back to '-created' unless the sort is allow-listed.
  const source = read('pb_hooks/03_agent_tasks.pb.js')

  assert.match(source, /status = \{:status\}/)
  assert.match(source, /findRecordsByFilter\('tasks',\s*filter,\s*sort,\s*100,\s*0,\s*params\)/)
  assert.match(source, /allowedSorts\.indexOf\(requestedSort\)/)
  assert.doesNotMatch(source, /status = "' \+ status/)
})

test('already-deployed databases receive a separate paginated fail-closed privacy upgrade', () => {
  const source = read('pb_migrations/z062_enforce_label_privacy.js')

  assert.match(source, /const PAGE_SIZE = 500/)
  assert.match(source, /offset \+= batch\.length/)
  assert.match(source, /task\.set\('is_private', true\)/)
  assert.match(source, /taskLabelField\.maxSelect = 99/)
  assert.match(source, /TASK_VISIBILITY_RULE/)
})

test('already-deployed privacy rules match shared members through relation ids', () => {
  const initial = read('pb_migrations/z061_label_visibility.js')
  const upgrade = read('pb_migrations/z062_enforce_label_privacy.js')
  const ruleFix = read('pb_migrations/z063_fix_shared_label_rules.js')

  for (const migration of [initial, upgrade, ruleFix]) {
    assert.match(migration, /shared_with\.id \?= @request\.auth\.id/)
    assert.match(migration, /label\.shared_with\.id \?= @request\.auth\.id/)
  }
  assert.match(ruleFix, /app\.save\(labels\)/)
  assert.match(ruleFix, /app\.save\(tasks\)/)
})

test('active user and agent APIs enforce label visibility and dual-write canonical task labels', () => {
  const main = read('pb_hooks/main.pb.js')
  const agents = read('pb_hooks/05_agents_routes.pb.js')
  const authLib = read('pb_hooks/lib/auth.js')

  assert.match(main, /function _canAccessTask\(/)
  assert.match(main, /_canAccessTask\(r\)/)
  assert.match(main, /function _canAccessLabel\(/)
  assert.match(main, /filter\(_canAccessLabel\)/)
  assert.match(main, /rec\.set\('label', canonicalLabels\)/)
  assert.match(main, /if \(type === 'task' && !_canAccessTask\(rec\)\)/)

  assert.match(agents, /routerAdd\('POST', '\/api\/agent\/dispatch'[\s\S]{0,12000}var hasScope = authLib\.hasAgentScope;/)
  assert.match(agents, /routerAdd\('GET', '\/api\/agent\/dispatch'[\s\S]{0,12000}var hasScope = authLib\.hasAgentScope;/)
  assert.match(agents, /var canAccessTaskForUser = authLib\.canAccessTaskForUser;/)
  assert.match(agents, /canAccessTaskForUser\(tr, ownerUser\)/)
  assert.match(agents, /\(info && info\.auth\) \|\| c\.get\('authRecord'\)/)
  assert.match(agents, /rec\.set\('permissions', scopes\)/)
  assert.match(agents, /rec\.set\('scopes', scopes\)/)
  assert.match(authLib, /getString\('scopes'\)/)
  assert.doesNotMatch(agents, /'agent_keys',[\s\S]{0,160}'-created'/)
  assert.doesNotMatch(agents, /hashWithPassword|compareWithHash/)
  assert.match(agents, /\$security\.sha256\(rawKey\)/)
  assert.match(authLib, /\$security\.equal\(storedHash, hashToken\(token\)\)/)
  assert.match(agents, /status = \{:status\}/)
  assert.doesNotMatch(agents, /status = \\\"' \+ status/)
  assert.match(agents, /findRecordsByFilter\('tasks', taskFilter, '-created', [^\n]+, queryParams\)/)
  assert.match(agents, /setCanonicalTaskLabels\(rec,/)
  assert.match(agents, /canAccessTaskForUser\(rec, ownerUser\)/)
})

test('all loaded agent task routes enforce the same label privacy contract', () => {
  const source = read('pb_hooks/03_agent_tasks.pb.js')
  const authLib = read('pb_hooks/lib/auth.js')

  assert.match(source, /function canAccessTaskForUser\(/)
  assert.match(source, /if\s*\(!canAccessTaskForUser\(t,\s*a\.user\)\)\s*continue/)
  assert.match(source, /if\s*\(!canAccessTaskForUser\(t,\s*a\.user\)\)\s*return c\.json\(403/)
  assert.match(source, /status = \{:status\}/)
  assert.doesNotMatch(source, /status = "'\+st\+'/)
  assert.match(source, /authLib\.requireApiToken\(c\)/) // token auth consolidated in lib/auth.js (GH#30)
  assert.match(authLib, /\$security\.sha256\(token\)/)
  assert.doesNotMatch(source, /\$security\.SHA256|return'd_'|return 'd_'/)
  assert.match(authLib, /getString\('permissions'\)/)
  assert.match(authLib, /getString\('scopes'\)/)
  assert.match(source, /\/api\/agent\/tasks\/\{id\}/)
  assert.match(source, /c\.request\.pathValue\('id'\)/)
})

test('ICS import and export cannot bypass privacy and keep canonical labels synchronized', () => {
  // Export generation lives in lib/ics-feed.js (shared with /api/calendar.ics).
  const source = read('pb_hooks/14_ics.pb.js') + read('pb_hooks/lib/ics-feed.js')

  assert.match(source, /function canAccessTaskForUser\(/)
  assert.match(source, /existingList\s*=\s*existingList\.filter\(function\(task\)\s*\{\s*return canAccessTaskForUser\(task,\s*auth\)/)
  assert.match(source, /tasks\s*=\s*tasks\.filter\(function\(task\)\s*\{\s*return canAccessTaskForUser\(task,\s*auth\)/)
  assert.match(source, /existing\.set\('label',uniqueLabels\)/)
  assert.match(source, /rec\.set\('label',uniqueLabels\)/)
  assert.doesNotMatch(source, /c\.queryParam\(/)
  assert.match(source, /info\.query\s*\|\|\s*\{\}/)
})

test('custom task authorization matches the collection rule for mixed non-family labels', () => {
  const migration = read('pb_migrations/z062_enforce_label_privacy.js')
  const main = read('pb_hooks/main.pb.js')
  const agents = read('pb_hooks/05_agents_routes.pb.js')
  const authLib = read('pb_hooks/lib/auth.js')

  assert.match(migration, /label:length = 1/)
  assert.match(main, /ids\.length > 1[\s\S]{0,360}mixedVis !== 'family'/)
  assert.match(authLib, /labelIds\.length > 1[\s\S]{0,500}mixedVisibility !== 'family'/)
  assert.doesNotMatch(agents, /labelIds\.length > 1/) // mixed-label logic consolidated in lib/auth.js (GH#30)
})

test('frontend clients propagate all labels to the canonical relation instead of only the first label', () => {
  for (const path of ['src/lib/pocketbase-client.ts']) {
    const source = read(path)
    assert.doesNotMatch(source, /label:\s*[^\n]*labels\?\.\[0\]/, path)
    assert.doesNotMatch(source, /payload\.label\s*=\s*updates\.labels\?\.\[0\]/, path)
  }
})

test('invite flow keeps generated, entered, validated, and registered codes on one canonical contract', () => {
  const backend = read('pb_hooks/main.pb.js')
  const client = read('src/lib/pocketbase-client.ts')
  const register = read('src/components/Register.tsx')
  const migration = read('pb_migrations/z066_normalize_invite_codes.js')

  assert.match(backend, /\$security\.randomString\(12\)\.toUpperCase\(\)/)
  assert.equal((backend.match(/set\('id', \$security\.randomString\(15\)\.toLowerCase\(\)\)/g) || []).length, 2)
  assert.match(migration, /record\.set\('code', normalized\)/)
  assert.match(migration, /toUpperCase\(\)/)
  assert.match(backend, /String\(q\.code \|\| ''\)\.trim\(\)\.toUpperCase\(\)/)
  assert.match(backend, /String\(d\.invite_code \|\| ''\)\.trim\(\)\.toUpperCase\(\)/)
  assert.match(register, /const INVITE_CODE_LENGTH = 12;/)
  assert.match(register, /maxLength=\{INVITE_CODE_LENGTH\}/)
  assert.match(register, /inviteCode\.length < INVITE_CODE_LENGTH/)
  assert.match(client, /return \{ id: data\.id, code: data\.code, status: 'valid', message: data\.message \|\| '' \}/)
  assert.doesNotMatch(client, /data\.invite\.(id|code)/)
})

// GH#99: the invite/family baseline (tests/invite-flow-baseline.md,
// BT-P0-001…016) is executed for real by tests/e2e/05-invite-family.spec.ts
// (two browser contexts, invalid/expired/reused invites, desktop/tablet/mobile)
// instead of checking that the IDs occur in the Markdown file.

test('all active token and agent management routes use PB 0.35 APIs and bound filters', () => {
  const main = read('pb_hooks/main.pb.js')
  const agents = read('pb_hooks/05_agents_routes.pb.js')
  const agentTasks = read('pb_hooks/03_agent_tasks.pb.js')
  const authLib = read('pb_hooks/lib/auth.js')

  assert.doesNotMatch(main, /\$security\.SHA256|return'd_'/)
  // Token auth was consolidated into pb_hooks/lib/auth.js (GH#30); the shared
  // implementation is what main.pb.js routes execute via bearerAuthMiddleware.
  assert.match(authLib, /\$security\.sha256\(token\)/)
  assert.match(authLib, /token_hash = \{:hash\}/)
  assert.match(authLib, /getString\('permissions'\)/)
  assert.match(authLib, /getString\('scopes'\)/)
  assert.match(main, /_hasPerm\('entries:read'\)/)
  assert.doesNotMatch(agents, /\/api\/agent\/keys\/:id\/revoke|c\.pathParam\(/)
  assert.match(agents, /\/api\/agent\/keys\/\{id\}\/revoke/)
  assert.match(agents, /c\.request\.pathValue\('id'\)/)
  assert.match(agents, /user = \{:userId\}[\s\S]{0,120}10000[\s\S]{0,80}\{ userId: auth\.id \}/)
  assert.match(agentTasks, /var filter='user = \{:userId\}'/)
  assert.match(agentTasks, /reminder_time >= \{:now\}/)
  assert.match(agentTasks, /rec\.set\('user',a\.uid\)/)
})

test('agent audit logs persist the request client IP (GH#24)', () => {
  const agents = read('pb_hooks/05_agents_routes.pb.js')
  const authLib = read('pb_hooks/lib/auth.js')

  // Shared helper in auth.js: realIP() is TrustedProxy-aware, remoteIP() is the fallback
  assert.match(authLib, /function getClientIP\(c\)/)
  assert.match(authLib, /c\.realIP\(\)/)
  assert.match(authLib, /c\.remoteIP\(\)/)

  // Every auditLog() call site in the route file must forward the request context
  const callSites = agents.match(/auditLog\([^;]*\)/g) || []
  assert.ok(callSites.length >= 12, `expected >=12 auditLog call sites, got ${callSites.length}`)
  for (const site of callSites) {
    assert.match(site, /,\s*c\)$/, `call site not forwarding c: ${site}`)
  }

  // Exactly one shared auditLog definition, wired to getClientIP(c); no hard-coded empty ip
  assert.doesNotMatch(authLib, /set\('ip_address',\s*''\)/)
  assert.doesNotMatch(authLib, /set\('ip_address',\s*String\(''\s*\|\|\s*''\)\)/)
  const auditLogDefinitions = authLib.match(/function auditLog\(agentKey, action, entityType, entityId, details, c\)/g) || []
  const ipWrites = authLib.match(/set\('ip_address', getClientIP\(c\)\)/g) || []
  assert.equal(auditLogDefinitions.length, 1)
  assert.equal(ipWrites.length, 1)
  assert.equal(auditLogDefinitions.length, ipWrites.length)
})

test('existing agent key schemas allow a persisted false revoked state', () => {
  const migration = read('pb_migrations/z064_fix_agent_key_revocation.js')

  assert.match(migration, /findCollectionByNameOrId\('agent_keys'\)/)
  assert.match(migration, /getByName\('active'\)/)
  assert.match(migration, /activeField\.required = false/)
  assert.match(migration, /app\.save\(keys\)/)
})

test('empty canonical label relations remain writable for normal quick-add tasks', () => {
  const fresh = read('pb_migrations/z061_label_visibility.js')
  const privacyUpgrade = read('pb_migrations/z062_enforce_label_privacy.js')
  const sharedUpgrade = read('pb_migrations/z063_fix_shared_label_rules.js')
  const existingInstallFix = read('pb_migrations/z065_fix_empty_task_label_rules.js')

  for (const source of [fresh, privacyUpgrade, sharedUpgrade, existingInstallFix]) {
    assert.match(source, /label:length = 0/)
  }
  assert.match(existingInstallFix, /tasks\.createRule =/)
  assert.match(existingInstallFix, /tasks\.updateRule =/)
})

test('every auto-loaded PocketBase hook uses PB 0.35 route and crypto APIs', () => {
  const hookDir = new URL('pb_hooks/', root)
  const loaded = fs.readdirSync(hookDir)
    .filter((name) => name.endsWith('.pb.js'))
    .map((name) => [name, fs.readFileSync(new URL(name, hookDir), 'utf8')])

  for (const [name, source] of loaded) {
    assert.doesNotMatch(source, /\$security\.SHA256/, `${name} uses uppercase SHA256`)
    assert.doesNotMatch(source, /return\s*['"]d_|['"]d_['"]\s*\+/, `${name} contains a weak fallback hash`)
    assert.doesNotMatch(source, /routerAdd\([^\n]+\/:\w+/, `${name} uses Express-style route params`)
    assert.doesNotMatch(source, /c\.pathParam\(/, `${name} uses removed pathParam()`)
    assert.doesNotMatch(source, /\$app\.dao\(\)|\$app\.unsafeWithoutHooks\(\)/, `${name} uses a removed PocketBase DAO API`)
    assert.doesNotMatch(source, /\$request\.|\$env\.|new Fetch\(|RecordUpsertAction/, `${name} uses a removed PocketBase hook API`)
    assert.doesNotMatch(source, /findRecordsByFilter\([\s\S]{0,220}?,\s*0\s*,\s*0(?:\s*[,\)])/, `${name} uses a zero record limit`)
  }
})
