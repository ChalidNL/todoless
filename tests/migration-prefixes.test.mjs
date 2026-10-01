// GH#38 — migration file names must carry a unique prefix.
//
// PocketBase applies pb_migrations/*.js in lexical order and records applied
// files by NAME. Two files with the same numeric prefix still run (the full
// name differs), but the prefix no longer says anything about order, reviews
// and bug reports start talking about "migration 049" when there are two of
// them, and a later rename to fix it would re-run the migration on existing
// installs (GH#34 — never rename an applied migration).
//
// The seven historical duplicates are frozen below so this check can land
// without renaming anything; the list may only shrink. New files must use the
// next free prefix (see CONTRIBUTING.md, "Database migrations").
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const dir = new URL('../pb_migrations/', import.meta.url)
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort()

const NAME = /^(z?)(\d{3})_[a-z0-9_]+\.js$/

// Prefixes that were already duplicated when this check was introduced.
// Do not add to this list — pick the next free number instead.
const KNOWN_DUPLICATE_PREFIXES = new Set(['032', '039', '049', '050', 'z066', 'z067', 'z069'])

test('every migration file is <prefix>_<snake_case>.js with a three-digit prefix', () => {
  const bad = files.filter((f) => !NAME.test(f))
  assert.deepEqual(bad, [], `unexpected migration file names: ${bad.join(', ')}`)
})

test('no two migrations share a prefix (beyond the frozen historical duplicates)', () => {
  const byPrefix = new Map()
  for (const f of files) {
    const [, z, num] = f.match(NAME)
    const prefix = z + num
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, [])
    byPrefix.get(prefix).push(f)
  }
  const duplicates = [...byPrefix.entries()].filter(([, list]) => list.length > 1)
  const newDuplicates = duplicates.filter(([prefix]) => !KNOWN_DUPLICATE_PREFIXES.has(prefix))
  assert.deepEqual(
    newDuplicates.map(([prefix, list]) => `${prefix}: ${list.join(', ')}`),
    [],
    'duplicate migration prefix — use the next free number (CONTRIBUTING.md, Database migrations)',
  )
  // A frozen duplicate that has been resolved (via a declared rename) must be
  // removed from the allowlist so it cannot silently come back.
  const stale = [...KNOWN_DUPLICATE_PREFIXES].filter((p) => !duplicates.some(([prefix]) => prefix === p))
  assert.deepEqual(stale, [], `prefixes no longer duplicated — drop them from KNOWN_DUPLICATE_PREFIXES: ${stale.join(', ')}`)
})

test('the next free prefix is unambiguous (highest numeric and z-prefix reported)', () => {
  const numeric = files.filter((f) => /^\d{3}_/.test(f)).map((f) => Number(f.slice(0, 3)))
  const zed = files.filter((f) => /^z\d{3}_/.test(f)).map((f) => Number(f.slice(1, 4)))
  assert.ok(numeric.length > 0)
  // Informational for contributors; the assertions above are the gate.
  console.log(`[migration-prefixes] highest numeric prefix: ${String(Math.max(...numeric)).padStart(3, '0')}, highest z-prefix: z${String(Math.max(...zed)).padStart(3, '0')}`)
})
