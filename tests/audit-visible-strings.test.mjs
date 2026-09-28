import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const script = path.join(root, 'scripts', 'audit-visible-strings.cjs')

function runAudit(target) {
  return spawnSync(process.execPath, [script, target], { cwd: root, encoding: 'utf8' })
}

test('audit-visible-strings.cjs flags the original blind-spot classes', () => {
  const fixture = path.join(root, 'tests', 'fixtures', 'audit-visible-strings', 'raw')
  const res = runAudit(fixture)
  assert.equal(res.status, 1, 'audit must fail (exit 1) when visible strings are found')
  // Capitalised single words
  assert.match(res.stdout, /Zichtbaarheid/)
  assert.match(res.stdout, /Geblokkeerd/)
  // All-caps words in object literal values (badgeLabel)
  assert.match(res.stdout, /TAKEN/)
  assert.match(res.stdout, /FOCUS/)
  // Template literal with ${} inside a visible attribute
  assert.match(res.stdout, /attr-expr-tpl:aria-label/)
})

test('audit-visible-strings.cjs accepts i18n-ignore comments', () => {
  const fixture = path.join(root, 'tests', 'fixtures', 'audit-visible-strings', 'ignored')
  const res = runAudit(fixture)
  assert.equal(res.status, 0, `expected no hits in ignored fixture, got: ${res.stdout}`)
})

test('audit-visible-strings.cjs passes on the real src tree (all visible text i18n-routed)', () => {
  const res = runAudit(path.join(root, 'src'))
  assert.equal(res.status, 0, `expected 0 hits on src, got: ${res.stdout}`)
})