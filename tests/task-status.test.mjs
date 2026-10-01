// #232 - one task status vocabulary for every route.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const root = new URL('../', import.meta.url)
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8')

function loadLib() {
  const sandbox = { module: { exports: {} } }
  vm.createContext(sandbox)
  vm.runInContext(read('pb_hooks/lib/task-status.js'), sandbox)
  return sandbox.module.exports
}

test('the vocabulary is the schema select: backlog, todo, done', () => {
  const { TASK_STATUSES, isTaskStatus } = loadLib()
  assert.deepEqual([...TASK_STATUSES], ['backlog', 'todo', 'done']) // array from the vm context: compare values
  for (const s of TASK_STATUSES) assert.ok(isTaskStatus(s))
  for (const s of ['in_progress', 'cancelled', 'doing', '', null, undefined]) assert.equal(isTaskStatus(s), false)
})

test('in_progress is an alias of todo; input is trimmed; empty stays empty', () => {
  const { normalizeTaskStatus } = loadLib()
  assert.equal(normalizeTaskStatus('in_progress'), 'todo')
  assert.equal(normalizeTaskStatus(' done '), 'done')
  assert.equal(normalizeTaskStatus(''), '')
  assert.equal(normalizeTaskStatus(null), '')
  assert.equal(normalizeTaskStatus(undefined), '')
  assert.equal(normalizeTaskStatus('cancelled'), 'cancelled') // not an alias - callers must validate
})

test('no route keeps a private status list any more', () => {
  const sources = ['pb_hooks/03_agent_tasks.pb.js', 'pb_hooks/05_agents_routes.pb.js', 'pb_hooks/main.pb.js'].map(read)
  for (const source of sources) {
    assert.match(source, /lib\/task-status\.js/)
    assert.doesNotMatch(source, /\[\s*'todo'\s*,\s*'in_progress'/)
    assert.doesNotMatch(source, /'cancelled'/)
    assert.doesNotMatch(source, /validStatuses|validReadStatuses|allowedStatuses/)
  }
})
