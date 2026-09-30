// GH#9 — Custom routes must never return raw exception text / stack traces to
// clients and must log server-side instead (PRD NFR-SEC-002).
//
// Contracts:
//   1. pb_hooks/lib/errors.js exports a respondError() helper that logs the
//      real error server-side (console + $app.logger()) and returns a GENERIC
//      client body — no exception text.
//   2. pb_hooks/04_request_logger.pb.js binds `respondError` as a global so
//      every auto-loaded route handler can call it.
//   3. NO client-facing `c.json(...)` in any pb_hooks file embeds raw dynamic
//      error text (String(e)/e.stack/message) anymore.
//   4. Every file that previously leaked now calls respondError().
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = new URL('../', import.meta.url)
const read = (rel) => fs.readFileSync(new URL(rel, root), 'utf8')

// --- 1. Helper behavioral contract ---------------------------------------
test('respondError returns a generic client body and logs the real error server-side', () => {
  const { respondError } = require('../pb_hooks/lib/errors.js')
  assert.equal(typeof respondError, 'function')

  const logged = []
  const printed = []
  const origError = console.error
  global.$app = { logger: () => ({ error: (msg) => logged.push(msg) }) }
  const responded = []
  const c = {
    requestInfo: () => ({ method: 'POST', path: '/api/v1' }),
    get: (k) => (k === 'authRecord' ? { id: 'user-abc' } : null),
    json: (status, body) => { responded.push({ status, body }); return body },
  }
  console.error = (m) => printed.push(m)
  try {
    const result = respondError(c, new Error('internal detail: db connection refused'), 500)
    assert.deepEqual(result, { error: 'Internal server error' })
    assert.deepEqual(responded, [{ status: 500, body: { error: 'Internal server error' } }])
    assert.doesNotMatch(result.error, /internal detail|db connection/i, 'client must not see the real error')

    // Server-side logging must contain route + user context AND the real detail.
    assert.equal(logged.length, 1)
    assert.match(logged[0], /POST \/api\/v1/)
    assert.match(logged[0], /user=user-abc/)
    assert.match(logged[0], /internal detail: db connection refused/)
    assert.equal(printed.length, 1)
    assert.match(printed[0], /internal detail: db connection refused/)
  } finally {
    console.error = origError
    delete global.$app
  }
})

test('respondError supports custom message + extra response fields (constructed errors only)', () => {
  const { respondError } = require('../pb_hooks/lib/errors.js')
  const origError = console.error
  global.$app = { logger: () => ({ error: () => {} }) }
  console.error = () => {}
  try {
    const c = {
      requestInfo: () => ({ method: 'POST', path: '/api/integrations/mail/webhook' }),
      get: () => null,
      json: (status, body) => body,
    }
    const result = respondError(c, new Error('upstream unreachable'), 502, 'Connection failed', { configured: true })
    assert.deepEqual(result, { error: 'Connection failed', configured: true })
  } finally {
    console.error = origError
    delete global.$app
  }
})

test('respondError defaults to 500 when status omitted', () => {
  const { respondError } = require('../pb_hooks/lib/errors.js')
  const origError = console.error
  global.$app = { logger: () => ({ error: () => {} }) }
  console.error = () => {}
  let status = null
  try {
    const c = {
      requestInfo: () => ({ method: 'GET', path: '/api/whatever' }),
      get: () => null,
      json: (s) => { status = s; return { error: 'Internal server error' } },
    }
    respondError(c, new Error('boom'))
    assert.equal(status, 500)
  } finally {
    console.error = origError
    delete global.$app
  }
})

// --- 2. Global shim binding ----------------------------------------------
test('04_request_logger.pb.js binds respondError as a global (PB auto-loaded shim)', () => {
  const source = read('pb_hooks/04_request_logger.pb.js')
  assert.match(source, /function respondError\(c, e, status, message, extra\)/)
  assert.match(source, /globalThis\.respondError = respondError;/)
  assert.match(source, /require\(__hooks \+ '\/lib\/errors\.js'\)/)
})

// --- 3. No leak pattern anywhere in pb_hooks ------------------------------
const LEAK_PATTERNS = [
  /c\.json\(\s*\d{3}\s*,[^)]*String\(\s*(?:e|err|error|ex)\s*\)/, // raw String(e/err/...)
  /c\.json\(\s*\d{3}\s*,[^)]*\.stack/, // stack traces
  /c\.json\(\s*\d{3}\s*,[^)]*(?:e|err|error|ex)\.message/, // e.message/err.message in responses
  /c\.json\(\s*\d{3}\s*,[^)]*JSON\.stringify\(\s*(?:e|err|error|ex)/, // serialized error objects
  /c\.json\(\s*\d{3}\s*,[^)]*String\(\(?err/, // err.message coercion
  /(?:error|errors)\s*[:=]\s*String\(\s*e\d*\s*\)/, // raw String(e/e2/...) assigned to error key / pushed into error arrays (object-key position only — NOT .error(...) logger calls)
]

const HOOK_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'pb_hooks')

function hookFiles() {
  const out = []
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name)
      const stat = fs.statSync(full)
      if (stat.isDirectory()) walk(full)
      else if (name.endsWith('.js')) out.push(full)
    }
  }
  walk(HOOK_ROOT)
  return out
}

test('no pb_hooks file embeds raw exception text in a client response', () => {
  const files = hookFiles()
  // GH#99: don't hardcode the total file count — assert the scan covers at
  // least the root .pb.js hooks (the auto-loaded route handlers); lib/
  // modules may grow the total without weakening the guarantee.
  const rootHookCount = fs.readdirSync(HOOK_ROOT).filter((n) => n.endsWith('.pb.js')).length
  assert.ok(files.length >= Math.max(10, rootHookCount), `expected a meaningful scan set (>= ${Math.max(10, rootHookCount)} hook files), got ${files.length}`)
  for (const file of files) {
    const rel = path.relative(path.dirname(HOOK_ROOT), file)
    const source = fs.readFileSync(file, 'utf8')
    for (const pattern of LEAK_PATTERNS) {
      assert.doesNotMatch(source, pattern, `${rel} still leaks: ${pattern}`)
    }
  }
})

// --- 4. Previously-leaky live files now use respondError ------------------
test('every previously-leaky hook file calls respondError in its error path', () => {
  // GH#99: don't pin exact call-site counts (they churn with route changes);
  // every route-handler catch must call respondError at least once — that is
  // the no-error-leak guarantee.
  const expectations = {
    'pb_hooks/main.pb.js': 1,
    'pb_hooks/03_agent_tasks.pb.js': 1,
    'pb_hooks/05_agents_routes.pb.js': 1,
    'pb_hooks/09_api_tokens.pb.js': 1,
    'pb_hooks/13_companion.pb.js': 1,
    'pb_hooks/14_ics.pb.js': 1,
    'pb_hooks/lib/auth.js': 1,
  }
  for (const [file, min] of Object.entries(expectations)) {
    const source = read(file)
    const count = (source.match(/respondError\(/g) || []).length
    assert.ok(count >= min, `${file}: expected >= ${min} respondError( call sites, found ${count}`)
  }
})