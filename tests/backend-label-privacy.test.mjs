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

test('custom task routes enforce private and label visibility instead of bypassing collection rules', () => {
  const source = read('pb_hooks/routes/tasks.js')

  assert.match(source, /is_private = false/)
  assert.match(source, /label\.visibility:each = "family"/)
  assert.match(source, /if \(!canViewTask\(record\)\)/)
})

test('custom task routes write every legacy label into the canonical relation on create and update', () => {
  const source = read('pb_hooks/routes/tasks.js')

  assert.match(source, /set\('label', canonicalLabels\)/)
  assert.match(source, /body\.has\('labels'\) \|\| body\.has\('label'\)/)
  assert.doesNotMatch(source, /labels\s*\[0\]/)
})

test('recurring task generation copies the complete canonical label relation', () => {
  const source = read('pb_hooks/cron/recurring-tasks.js')

  assert.match(source, /task\.get\('label'\)/)
  assert.match(source, /set\('label', canonicalLabels\)/)
  assert.doesNotMatch(source, /labels\s*\[0\]/)
})

test('task list route binds filter inputs and allow-lists sort fields', () => {
  const source = read('pb_hooks/routes/tasks.js')

  assert.match(source, /status = \{:status\}/)
  assert.match(source, /findRecordsByFilter\('tasks', filter, sort, 0, 0, filterParams\)/)
  assert.match(source, /allowedSorts\.indexOf\(requestedSort\)/)
  assert.doesNotMatch(source, /status = \\"' \+ status/)
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

  assert.match(main, /function _canAccessTask\(/)
  assert.match(main, /_canAccessTask\(r\)/)
  assert.match(main, /function _canAccessLabel\(/)
  assert.match(main, /filter\(_canAccessLabel\)/)
  assert.match(main, /rec\.set\('label', canonicalLabels\)/)
  assert.match(main, /if \(type === 'task' && !_canAccessTask\(rec\)\)/)

  assert.match(agents, /routerAdd\('POST', '\/api\/agent\/dispatch'[\s\S]{0,12000}function hasScope\(/)
  assert.match(agents, /routerAdd\('GET', '\/api\/agent\/dispatch'[\s\S]{0,12000}function hasScope\(/)
  assert.match(agents, /function canAccessTaskForUser\(/)
  assert.match(agents, /canAccessTaskForUser\(tr, ownerUser\)/)
  assert.match(agents, /\(info && info\.auth\) \|\| c\.get\('authRecord'\)/)
  assert.match(agents, /rec\.set\('permissions', scopes\)/)
  assert.match(agents, /rec\.set\('scopes', scopes\)/)
  assert.match(agents, /getString\('scopes'\)/)
  assert.doesNotMatch(agents, /'agent_keys',[\s\S]{0,160}'-created'/)
  assert.doesNotMatch(agents, /hashWithPassword|compareWithHash/)
  assert.match(agents, /\$security\.sha256\(rawKey\)/)
  assert.match(agents, /\$security\.equal\(storedHash, \$security\.sha256\(token\)\)/)
  assert.match(agents, /status = \{:status\}/)
  assert.doesNotMatch(agents, /status = \\\"' \+ status/)
  assert.match(agents, /findRecordsByFilter\('tasks', taskFilter, '-created', [^\n]+, queryParams\)/)
  assert.match(agents, /setCanonicalTaskLabels\(rec,/)
  assert.match(agents, /canAccessTaskForUser\(rec, ownerUser\)/)
})

test('all loaded agent task routes enforce the same label privacy contract', () => {
  const source = read('pb_hooks/03_agent_tasks.pb.js')

  assert.match(source, /function canAccessTaskForUser\(/)
  assert.match(source, /if\s*\(!canAccessTaskForUser\(t,\s*a\.user\)\)\s*continue/)
  assert.match(source, /if\s*\(!canAccessTaskForUser\(t,\s*a\.user\)\)\s*return c\.json\(403/)
  assert.match(source, /status = \{:status\}/)
  assert.doesNotMatch(source, /status = "'\+st\+'/)
  assert.match(source, /\$security\.sha256\(raw\)/)
  assert.doesNotMatch(source, /\$security\.SHA256|return'd_'|return 'd_'/)
  assert.match(source, /getString\('permissions'\)/)
  assert.match(source, /getString\('scopes'\)/)
  assert.match(source, /\/api\/agent\/tasks\/\{id\}/)
  assert.match(source, /c\.request\.pathValue\('id'\)/)
})

test('ICS import and export cannot bypass privacy and keep canonical labels synchronized', () => {
  const source = read('pb_hooks/14_ics.pb.js')

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

  assert.match(migration, /label:length = 1/)
  assert.match(main, /ids\.length > 1[\s\S]{0,360}mixedVis !== 'family'/)
  assert.match(agents, /labelIds\.length > 1[\s\S]{0,500}visibility !== 'family'/)
})

test('frontend clients propagate all labels to the canonical relation instead of only the first label', () => {
  for (const path of ['src/lib/pocketbase-client.ts', 'src/lib/api-client.ts']) {
    const source = read(path)
    assert.doesNotMatch(source, /label:\s*[^\n]*labels\?\.\[0\]/, path)
    assert.doesNotMatch(source, /payload\.label\s*=\s*updates\.labels\?\.\[0\]/, path)
  }
})

test('all active token and agent management routes use PB 0.35 APIs and bound filters', () => {
  const main = read('pb_hooks/main.pb.js')
  const agents = read('pb_hooks/05_agents_routes.pb.js')
  const agentTasks = read('pb_hooks/03_agent_tasks.pb.js')

  assert.doesNotMatch(main, /\$security\.SHA256|return'd_'/)
  assert.match(main, /\$security\.sha256\(token\)/)
  assert.match(main, /token_hash = \{:hash\}/)
  assert.match(main, /getString\('permissions'\)/)
  assert.match(main, /getString\('scopes'\)/)
  assert.match(main, /_hasPerm\('entries:read'\)/)
  assert.doesNotMatch(agents, /\/api\/agent\/keys\/:id\/revoke|c\.pathParam\(/)
  assert.match(agents, /\/api\/agent\/keys\/\{id\}\/revoke/)
  assert.match(agents, /c\.request\.pathValue\('id'\)/)
  assert.match(agents, /user = \{:userId\}[\s\S]{0,120}10000[\s\S]{0,80}\{ userId: auth\.id \}/)
  assert.match(agentTasks, /var filter='user = \{:userId\}'/)
  assert.match(agentTasks, /reminder_time >= \{:now\}/)
  assert.match(agentTasks, /rec\.set\('user',a\.uid\)/)
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
