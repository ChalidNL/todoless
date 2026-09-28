// GH#36 — users.createRule migration semantics + rollback-safety regression test.
//
// Static test over pb_migrations/*.js (no PocketBase needed):
//
//   1. FINAL STATE: replaying every migration's up() in application order
//      (filename sort = PocketBase application order) must leave
//      users.createRule === null (locked: superuser-only / invite-only).
//      010 / 012 / 018 / 025 previously flip-flopped between '' (public) and
//      null (locked); 051/053 lock it for good. See issue #36.
//
//   2. ROLLBACK SAFETY: once registration was opened with '' (public) and then
//      locked with null (051/053), rolling back any later lock migration must
//      NOT restore '' — that would silently reopen public registration without
//      an invite. down() must keep the lock (or be a no-op).
//
//   3. DOCUMENTED SEMANTICS: migration comments must document PocketBase's
//      actual rule semantics (null = superuser-only/locked, '' = public) — the
//      historical 010 comment had them inverted.
//
// Runs via `node --test tests/*.test.mjs` in CI (quality-gate.yml).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const migrationsDir = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'pb_migrations')
const CREATE_RULE_RE = /users\.createRule\s*=\s*(null|''|"")/g

// Split the first migrate(up, down) call in a migration file into its up() and
// down() bodies by brace depth. All repo migrations have exactly one migrate()
// call; files that touch users.createRule are simple single-call files.
function splitUpDown(src) {
  const migrateCount = (src.match(/migrate\(/g) || []).length
  assert.equal(migrateCount, 1, 'migration files touching users.createRule must contain exactly one migrate() call')
  const start = src.indexOf('migrate(')
  assert.ok(start !== -1, 'expected a migrate() call in the file')
  const bodyOpen = src.indexOf('{', start)
  assert.ok(bodyOpen !== -1, 'expected a function body {')
  let depth = 0
  let end = -1
  for (let i = bodyOpen; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1
    else if (src[i] === '}') {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  assert.ok(end !== -1, 'expected a closing } for the up() body')
  return { up: src.slice(bodyOpen, end + 1), down: src.slice(end + 1) }
}

// All explicit users.createRule assignments in a code section, in source order.
// Comments are stripped first so explanatory text cannot false-fail the guard.
function assignments(section) {
  const values = []
  let m
  const code = section.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  CREATE_RULE_RE.lastIndex = 0
  while ((m = CREATE_RULE_RE.exec(code))) values.push(m[1])
  return values
}

const migrationFiles = readdirSync(migrationsDir).filter((f) => f.endsWith('.js')).sort()
const migrations = migrationFiles.map((f) => { const src = readFileSync(path.join(migrationsDir, f), 'utf8'); return { file: f, src } })

// Files that touch users.createRule at all.
const touching = migrations.filter((m) => /users\.createRule/.test(m.src))

// Replay in application order: final applied value + last "public open" file.
let finalValue = 'unset'
let lastPublicIdx = -1
touching.forEach((m, idx) => {
  const upVals = assignments(splitUpDown(m.src).up)
  if (upVals.length > 0) {
    finalValue = upVals[upVals.length - 1]
    if (finalValue === "''" || finalValue === '""') lastPublicIdx = idx
  }
})

test('apply all migrations → users.createRule is null (locked) [GH#36]', () => {
  assert.ok(touching.length > 0, 'expected at least one migration to touch users.createRule')
  assert.equal(
    finalValue,
    'null',
    'after applying all migrations users.createRule must be null (locked); found: ' + finalValue,
  )
})

test('rolling back any post-public lock migration must NOT restore public registration [GH#36]', () => {
  assert.ok(lastPublicIdx >= 0, 'expected a migration that opened registration with "" (public)')
  const locks = touching.slice(lastPublicIdx + 1).filter((m) => {
    const upVals = assignments(splitUpDown(m.src).up)
    return upVals.length > 0 && upVals[upVals.length - 1] === 'null'
  })
  assert.ok(locks.length > 0, 'expected at least one lock migration after the public-open (051/053)')

  for (const m of locks) {
    const downVals = assignments(splitUpDown(m.src).down)
    assert.ok(
      !downVals.includes("''") && !downVals.includes('""'),
      `${m.file}: down() restores '' (public) — rolling back re-opens registration (GH#36)`,
    )
    // Lock must be preserved: either no createRule assignment (no-op) or null.
    for (const v of downVals) {
      assert.equal(v, 'null', `${m.file}: down() must keep the lock (null) or do nothing, got ${v}`)
    }
  }
})

test('no migration documents inverted rule semantics (null = open / empty-string = blocked) [GH#36]', () => {
  for (const m of migrations) {
    assert.ok(
      !/\bnull\s*=\s*open\b/i.test(m.src),
      `${m.file}: comment claims "null = open" — PocketBase semantics are inverted (null = locked)`,
    )
    assert.ok(
      !/empty\s+string\s*''?\s*=\s*blocked/i.test(m.src),
      `${m.file}: comment claims "'' = blocked" — PocketBase semantics are inverted ('' = public)`,
    )
  }
})

test('correct rule semantics are documented somewhere (null = superuser-only / locked) [GH#36]', () => {
  const hits = migrations.filter((m) => /\bnull\s*=\s*(only\s+superusers|superuser-only)\b/i.test(m.src))
  assert.ok(hits.length >= 1, 'expected at least one migration to document null = superuser-only (locked)')
})