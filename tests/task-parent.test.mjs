// #241: only a top-level task can be a parent -- no self-links, no cycles.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { parentLinkError } = require('../pb_hooks/lib/task-parent.js')

const rec = (id, linked_to = '', linked_type = linked_to ? 'task' : '') => ({ id, get: (k) => ({ linked_to, linked_type })[k] })

test('a top-level parent is fine; no link or a non-task link is not checked', () => {
  const tasks = { A: rec('A') }
  assert.equal(parentLinkError(rec('B', 'A'), (id) => tasks[id] || null), '')
  assert.equal(parentLinkError(rec('B'), () => null), '')
  assert.equal(parentLinkError(rec('B', 'N1', 'note'), () => null), '')
})

test('self-links, unknown parents and subtask parents are refused (so no cycle can form)', () => {
  const tasks = { A: rec('A'), B: rec('B', 'A'), C: rec('C', 'B') }
  const find = (id) => tasks[id] || null
  assert.match(parentLinkError(rec('A', 'A'), find), /own subtask/)
  assert.match(parentLinkError(rec('A', 'missing'), find), /not found/)
  // A -> B -> A: B is a subtask of A, so A cannot be moved under B.
  assert.match(parentLinkError(rec('A', 'B'), find), /cannot have subtasks/)
  // deeper: A -> B -> C -> A
  assert.match(parentLinkError(rec('A', 'C'), find), /cannot have subtasks/)
})

// A child written without linked_type (older writers, /api/v1 create before
// the default) is still a subtask when its linked_to is a task: the guard must
// see it, both as the record being linked and as a would-be parent.
test('a type-less link to a task counts as a task link', () => {
  const tasks = { A: rec('A'), B: rec('B', 'A', '') }
  const find = (id) => tasks[id] || null
  // B -> A without a type: moving A under B is still a cycle
  assert.match(parentLinkError(rec('A', 'B'), find), /cannot have subtasks/)
  // a type-less self-link is refused like a typed one
  assert.match(parentLinkError(rec('A', 'A', ''), find), /own subtask/)
  // a type-less link to an unknown id is not a task link (could be anything) - left alone
  assert.equal(parentLinkError(rec('A', 'ghost', ''), find), '')
  // a type-less link to a task is validated like a typed one
  assert.match(parentLinkError(rec('C', 'B', ''), find), /cannot have subtasks/)
  assert.equal(parentLinkError(rec('C', 'A', ''), find), '')
})
