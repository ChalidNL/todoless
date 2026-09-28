import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const root = new URL('../', import.meta.url)
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8')

const NOTIFICATION_FIELDS = [
  'notification_email',
  'notification_push',
  'task_reminders',
  'reminder_minutes',
  'briefing_enabled',
]

// Track fields in insertion order so a duplicate add (guard failure) is
// detectable: the same name would appear twice in all().
function fieldSet(initial = []) {
  const values = [...initial]
  return {
    getByName: (name) => values.find((field) => field.name === name),
    add: (field) => values.push(field),
    remove: (field) => {
      if (!field) return
      const index = values.findIndex((candidate) => candidate.name === field.name)
      if (index >= 0) values.splice(index, 1)
    },
    all: () => values,
  }
}

function executeMigration({ initialFields = [] } = {}) {
  let up
  let down
  const addedFields = []
  const collections = {
    app_settings: { id: 'app_settings', fields: fieldSet(initialFields) },
  }
  class BoolField {
    constructor(options) {
      Object.assign(this, options)
      addedFields.push(this)
    }
  }
  class NumberField {
    constructor(options) {
      Object.assign(this, options)
      addedFields.push(this)
    }
  }
  const app = {
    findCollectionByNameOrId: (name) => collections[name],
    save: () => {},
  }
  const sandbox = {
    migrate: (forward, backward) => {
      up = forward
      down = backward
    },
    BoolField,
    NumberField,
  }
  vm.createContext(sandbox)
  vm.runInContext(read('pb_migrations/073_add_app_settings_notification_fields.js'), sandbox)
  return { up, down, app, collections, addedFields }
}

test('GH#69 migration adds all five notification fields to app_settings', () => {
  const { up, app, collections } = executeMigration()

  up(app)

  for (const name of NOTIFICATION_FIELDS) {
    assert.ok(collections.app_settings.fields.getByName(name), `field ${name} was added`)
  }
  const reminder = collections.app_settings.fields.getByName('reminder_minutes')
  assert.equal(reminder.onlyInt, true)
  assert.equal(reminder.min, 1)
})

test('GH#69 migration is idempotent — running up() again does not duplicate fields', () => {
  const { up, app, collections } = executeMigration({
    initialFields: NOTIFICATION_FIELDS.map((name) => ({ name })),
  })

  up(app)

  for (const name of NOTIFICATION_FIELDS) {
    assert.equal(
      collections.app_settings.fields.all().filter((field) => field.name === name).length,
      1,
      `field ${name} must not be duplicated by a re-run`,
    )
  }
})

test('GH#69 migration rollback removes all five notification fields', () => {
  const { up, down, app, collections } = executeMigration()

  up(app)
  down(app)

  for (const name of NOTIFICATION_FIELDS) {
    assert.equal(collections.app_settings.fields.getByName(name), undefined, `field ${name} was removed`)
  }
})