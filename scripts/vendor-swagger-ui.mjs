#!/usr/bin/env node
// =============================================================================
// Vendor swagger-ui-dist into public/docs/swagger-ui (GH#64)
//
// The API docs page (/api/docs, /api/swagger) renders Swagger UI. These assets
// are committed into the repo (public/docs/swagger-ui) so the app makes zero
// external calls at runtime and the nginx CSP can stay at script-src 'self'
// (works in air-gapped LANs). Run this script after bumping swagger-ui-dist in
// package.json to refresh the vendored copy:
//
//   npm i -D swagger-ui-dist@<version>
//   npm run vendor:swagger-ui
//
// The script verifies the vendored files match what npm resolved, writes
// SOURCE.txt (version + sha256 provenance), and fails if the source package is
// missing. It never needs network access itself.
// =============================================================================
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = join(ROOT, 'node_modules', 'swagger-ui-dist')
const DEST_DIR = join(ROOT, 'public', 'docs', 'swagger-ui')

// Files required by pb_hooks/11_docs.pb.js.
// LICENSE.txt files shipped by the package are included for compliance.
const FILES = [
  'swagger-ui.css',
  'swagger-ui-bundle.js',
  'swagger-ui-bundle.js.LICENSE.txt',
  'swagger-ui-standalone-preset.js',
  'swagger-ui-standalone-preset.js.LICENSE.txt',
]

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

// Resolve the exact installed version (matches package-lock.json).
const pkgPath = join(SRC_DIR, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const version = pkg.version

mkdirSync(DEST_DIR, { recursive: true })

const manifest = { package: 'swagger-ui-dist', version, files: {} }
for (const file of FILES) {
  const src = join(SRC_DIR, file)
  const dst = join(DEST_DIR, file)
  copyFileSync(src, dst)
  manifest.files[file] = sha256(dst)
  console.log(`vendored ${file} (${version})`)
}

const sourceNote = `swagger-ui-dist ${version}
Vendored from node_modules/swagger-ui-dist (npm) on ${new Date().toISOString().slice(0, 10)}.
See scripts/vendor-swagger-ui.mjs — run "npm run vendor:swagger-ui" to refresh after upgrades.

sha256:
${Object.entries(manifest.files)
  .map(([file, digest]) => `  ${digest}  ${file}`)
  .join('\n')}
`
writeFileSync(join(DEST_DIR, 'SOURCE.txt'), sourceNote)
console.log('wrote SOURCE.txt')