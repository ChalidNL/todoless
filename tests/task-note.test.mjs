// #224: blocked_comment (app/API "description") and description (ICS) are
// kept identical by pb_hooks/lib/task-note.js.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { syncNoteOnCreate, syncNoteOnUpdate } = require('../pb_hooks/lib/task-note.js')

function rec(values) {
  const r = { ...values }
  r.get = (k) => r[k]
  r.set = (k, v) => { r[k] = v }
  return r
}

test('create: an API/app note fills description, an ICS description fills the app note', () => {
  const fromApp = rec({ blocked_comment: 'bring the forms', description: '' })
  syncNoteOnCreate(fromApp)
  assert.equal(fromApp.description, 'bring the forms')
  const fromIcs = rec({ blocked_comment: '', description: 'Dentist, room 3' })
  syncNoteOnCreate(fromIcs)
  assert.equal(fromIcs.blocked_comment, 'Dentist, room 3')
})

test('update: the changed field is mirrored to the other', () => {
  const edited = rec({ blocked_comment: 'new note', description: 'old note' })
  syncNoteOnUpdate(edited, rec({ blocked_comment: 'old note', description: 'old note' }))
  assert.equal(edited.description, 'new note')

  const reimported = rec({ blocked_comment: 'old', description: 'from calendar' })
  syncNoteOnUpdate(reimported, rec({ blocked_comment: 'old', description: 'old' }))
  assert.equal(reimported.blocked_comment, 'from calendar')

  const cleared = rec({ blocked_comment: '', description: 'old' })
  syncNoteOnUpdate(cleared, rec({ blocked_comment: 'old', description: 'old' }))
  assert.equal(cleared.description, '')
})

test('update: unrelated saves leave existing (possibly different) notes untouched', () => {
  const r = rec({ blocked_comment: 'A', description: 'B', title: 'renamed' })
  syncNoteOnUpdate(r, rec({ blocked_comment: 'A', description: 'B', title: 'old' }))
  assert.equal(r.blocked_comment, 'A')
  assert.equal(r.description, 'B')
})

test('update: when both changed, the app field wins', () => {
  const r = rec({ blocked_comment: 'app', description: 'ics' })
  syncNoteOnUpdate(r, rec({ blocked_comment: '', description: '' }))
  assert.equal(r.description, 'app')
})
