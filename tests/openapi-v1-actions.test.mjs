// #225: the /api/v1 OpenAPI spec must document every action the unified
// handler in pb_hooks/main.pb.js accepts, and must not list actions it lacks.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('every /api/v1 action is in the OpenAPI action enum and vice versa', () => {
  const handled = new Set([...read('pb_hooks/main.pb.js').matchAll(/action === '([a-z_]+)'/g)].map((m) => m[1]))
  const spec = read('pb_hooks/10_openapi.pb.js').match(/action: \{ type: "string", enum: \[([^\]]*)\]/)
  assert.ok(spec, 'action enum found in the OpenAPI spec')
  const documented = new Set([...spec[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]))
  assert.deepEqual([...handled].sort(), [...documented].sort())
})

test('OpenAPI status/priority enums match the tasks collection values', () => {
  const spec = read('pb_hooks/10_openapi.pb.js')
  assert.doesNotMatch(spec, /"urgent"|"normal"/, 'priority values were replaced by low/medium/high (migration 042)')
  assert.doesNotMatch(spec, /status: \{ type: "string", enum: \[[^\]]*"in_progress"/, 'in_progress is not a stored status')
})
