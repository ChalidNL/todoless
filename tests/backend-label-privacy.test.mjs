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

test('frontend clients propagate all labels to the canonical relation instead of only the first label', () => {
  for (const path of ['src/lib/pocketbase-client.ts', 'src/lib/api-client.ts']) {
    const source = read(path)
    assert.doesNotMatch(source, /label:\s*[^\n]*labels\?\.\[0\]/, path)
    assert.doesNotMatch(source, /payload\.label\s*=\s*updates\.labels\?\.\[0\]/, path)
  }
})
