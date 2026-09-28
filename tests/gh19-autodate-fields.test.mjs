// GH#19 — api_tokens autodate fields + agent_audit_log.created autodate.
//
// Static + VM-execution regression test:
//   1. Executes z069_add_autodate_fields_api_tokens_audit.js in a sandbox and
//      asserts both collections end up with autodate `created`/`updated`.
//   2. Asserts agent_audit_log's legacy plain-date `created` is upgraded to
//      autodate (replace-in-place, same column).
//   3. Asserts hooks no longer fake `created` with `new Date()`:
//      - main.pb.js /api/agent/list + /api/agent/pending fallbacks removed
//      - 12_api_routes.pb.js "no created column" workaround removed
//      - api-token creation responses return the persisted autodate value
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const root = new URL('../', import.meta.url)
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8')

function fakeField(name, type) {
  const id = 'fld_' + name
  return {
    id,
    name,
    type,
    onCreate: false,
    onUpdate: false,
  }
}

function executeMigration() {
  let up
  const collections = {
    api_tokens: {
      id: 'api_tokens',
      name: 'api_tokens',
      fields: {
        _map: new Map(),
        getByName(name) { return this._map.get(name) },
        add(field) { this._map.set(field.name, field); return this },
        removeById(id) { for (const f of this._map.values()) if (f.id === id) this._map.delete(f.name); return this },
        each(cb) { for (const f of this._map.values()) cb(f) },
      },
    },
    agent_audit_log: {
      id: 'agent_audit_log',
      name: 'agent_audit_log',
      fields: {
        _map: new Map(),
        getByName(name) { return this._map.get(name) },
        add(field) { this._map.set(field.name, field); return this },
        removeById(id) { for (const f of this._map.values()) if (f.id === id) this._map.delete(f.name); return this },
        each(cb) { for (const f of this._map.values()) cb(f) },
      },
    },
  }
  // Seed agent_audit_log with the legacy plain-date `created` field from 032.
  collections.agent_audit_log.fields.add(fakeField('created', 'date'))

  class AutodateField {
    constructor(options) {
      Object.assign(this, options)
      this.type = 'autodate'
    }
  }
  const app = {
    findCollectionByNameOrId: (name) => {
      if (!collections[name]) throw new Error('missing collection')
      return collections[name]
    },
    save: () => {},
  }
  const sandbox = {
    migrate: (forward) => { up = forward },
    AutodateField,
  }
  vm.createContext(sandbox)
  vm.runInContext(read('pb_migrations/z069_add_autodate_fields_api_tokens_audit.js'), sandbox)
  up(app)
  return { collections }
}

function fieldNameMap(collection) {
  const names = []
  collection.fields.each((f) => names.push(f.name))
  return names
}

test('z069 adds autodate created/updated to api_tokens', () => {
  const { collections } = executeMigration()
  const names = fieldNameMap(collections.api_tokens)
  assert.ok(names.includes('created'), 'api_tokens should gain created')
  assert.ok(names.includes('updated'), 'api_tokens should gain updated')

  const created = collections.api_tokens.fields.getByName('created')
  assert.equal(created.type, 'autodate')
  assert.equal(created.onCreate, true)
  assert.equal(created.onUpdate, false)

  const updated = collections.api_tokens.fields.getByName('updated')
  assert.equal(updated.type, 'autodate')
  assert.equal(updated.onCreate, true)
  assert.equal(updated.onUpdate, true)
})

test('z069 upgrades agent_audit_log plain-date created to autodate and adds updated', () => {
  const { collections } = executeMigration()
  const names = fieldNameMap(collections.agent_audit_log)
  assert.ok(names.includes('created'), 'agent_audit_log keeps created')
  assert.ok(names.includes('updated'), 'agent_audit_log gains updated')

  const created = collections.agent_audit_log.fields.getByName('created')
  assert.equal(created.type, 'autodate')
  assert.equal(created.onCreate, true)
  assert.equal(created.onUpdate, false)

  const updated = collections.agent_audit_log.fields.getByName('updated')
  assert.equal(updated.type, 'autodate')
})

test('/api/agent/list no longer fakes created with new Date()', () => {
  const source = read('pb_hooks/main.pb.js')
  const match = source.match(/routerAdd\('GET', '\/api\/agent\/list'[\s\S]{0,1600}/)
  assert.ok(match, 'agent/list route should exist')
  assert.doesNotMatch(match[0], /created: t\.get\('created'\) \|\| new Date\(\)/)
  assert.match(match[0], /created: t\.get\('created'\) \|\| ''/)
})

test('/api/agent/pending no longer fakes created with new Date()', () => {
  const source = read('pb_hooks/main.pb.js')
  const match = source.match(/routerAdd\('GET', '\/api\/agent\/pending'[\s\S]{0,1600}/)
  assert.ok(match, 'agent/pending route should exist')
  assert.doesNotMatch(match[0], /created: t\.get\('created'\) \|\| new Date\(\)/)
  assert.match(match[0], /created: t\.get\('created'\) \|\| ''/)
})

test('member token lookup no longer needs the no-created-column workaround', () => {
  const source = read('pb_hooks/12_api_routes.pb.js')
  assert.doesNotMatch(source, /no 'created' column/)
  assert.match(source, /findRecordsByFilter\('api_tokens', 'user = \{:userId\}', '-created'/)
})

test('api-token creation returns the persisted autodate created value', () => {
  const source = read('pb_hooks/09_api_tokens.pb.js')
  assert.doesNotMatch(source, /created: new Date\(\)\.toISOString\(\)/)
  assert.match(source, /created: rec\.get\('created'\)/)
})