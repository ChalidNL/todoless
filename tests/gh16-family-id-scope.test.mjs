// GH#16 — tasks/items collections have NO `family_id` column.
//
// Contract:
//   onRecordCreate('tasks') / onRecordCreate('items') in the LOADED hook
//   (pb_hooks/main.pb.js — PocketBase only auto-loads root *.pb.js files)
//   must not write or read `family_id` on the task/item record. The field
//   does not exist; the old auto-set block wrote it for every task/item
//   created through PB's native records API and PocketBase silently dropped
//   it, leaving dead code that pretended tasks carry their own family ref.
//   Family scoping lives on the owning user (user.family_id) — see the
//   list/view rules and routes/tasks.js.
//
// This is a source-level guard: a runtime test cannot observe the write
// because PB silently ignores non-existent fields on save.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8')

test('onRecordCreate tasks/items never write or read family_id (GH#16)', () => {
  const main = read('../pb_hooks/main.pb.js')
  const startTasks = main.indexOf("onRecordCreate('tasks'")
  const startItems = main.indexOf("onRecordCreate('items'")
  const endTasksHook = main.indexOf("onRecordUpdate('tasks'", startItems)
  assert.ok(startTasks >= 0 && startItems > startTasks && endTasksHook > startItems, 'hook boundaries found')

  const tasksHook = main.slice(startTasks, startItems)
  const itemsHook = main.slice(startItems, endTasksHook)

  assert.ok(!tasksHook.includes('family_id'), 'tasks create hook must not reference family_id')
  assert.ok(!itemsHook.includes('family_id'), 'items create hook must not reference family_id')
  // The auto-set block used to read the owner user's family_id and write it
  // onto the task/item record; neither may remain.
  assert.ok(!tasksHook.includes("set('family_id'"), 'tasks create hook must not set family_id')
  assert.ok(!itemsHook.includes("set('family_id'"), 'items create hook must not set family_id')
})