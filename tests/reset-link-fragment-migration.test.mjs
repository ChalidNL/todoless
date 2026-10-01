// z074: password-reset links carry the token in the fragment, never in the
// query string. Runs the migration against a fake app (no PocketBase).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../pb_migrations/z074_reset_link_fragment.js', import.meta.url), 'utf8')

function run(body, direction = 'up') {
  const users = { resetPasswordTemplate: { subject: 'Reset', body } }
  let saves = 0
  const app = { findCollectionByNameOrId: () => users, save: () => { saves++ } }
  const sandbox = { migrate: (up, down) => (direction === 'up' ? up : down)(app) }
  vm.runInNewContext(source, sandbox)
  return { body: users.resetPasswordTemplate.body, saves }
}

test('the z071 query link and the stock dashboard link become the fragment link', () => {
  for (const old of ['{APP_URL}/reset-password?token={TOKEN}', '{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}']) {
    const r = run(`<a href="${old}">Reset</a>`)
    assert.equal(r.body, '<a href="{APP_URL}/reset-password#token={TOKEN}">Reset</a>')
    assert.doesNotMatch(r.body, /\?token=/)
  }
})

test('a customised template is left alone, and a second run is a no-op', () => {
  const custom = run('<a href="https://family.example/reset/{TOKEN}">x</a>')
  assert.equal(custom.saves, 0)
  const once = run('{APP_URL}/reset-password?token={TOKEN}')
  const twice = run(once.body)
  assert.equal(twice.saves, 0)
  assert.equal(twice.body, once.body)
})

test('down migration restores the query link', () => {
  assert.equal(run('{APP_URL}/reset-password#token={TOKEN}', 'down').body, '{APP_URL}/reset-password?token={TOKEN}')
})
