// The production start command must not let PocketBase write migration files.
//
// PocketBase's `--automigrate` flag defaults to TRUE: a collection edit made in
// the dashboard or through the superuser API is written to the migrations
// directory as <timestamp>_updated_<collection>.js. In this project that
// directory is the mounted runtime volume, so such a file is invisible to the
// repository gates, re-runs on every start and collides with the next bundled
// migration that touches the same collection. Verified on 0.40.4: without the
// flag a PATCH /api/collections/shops produced 1790881084_updated_shops.js;
// with --automigrate=false it did not, and the bundled migrations still applied.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const root = new URL('../', import.meta.url)
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8')

function serveArgs(source, label) {
  const match = source.match(/\["serve",([^\]]*)\]/)
  assert.ok(match, `${label}: no ["serve", ...] command found`)
  return match[1].split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean)
}

for (const [file, label] of [['docker-compose.yml', 'docker-compose.yml command'], ['Dockerfile.pocketbase', 'Dockerfile.pocketbase CMD']]) {
  test(`${label} starts PocketBase with --automigrate=false`, () => {
    const args = serveArgs(read(file), label)
    assert.ok(args.includes('--automigrate=false'), `${label}: ${args.join(' ')}`)
    assert.ok(!args.includes('--automigrate'), `${label}: a bare --automigrate enables it`)
  })
}

test('compose and image agree on the serve command', () => {
  assert.deepEqual(serveArgs(read('docker-compose.yml'), 'compose'), serveArgs(read('Dockerfile.pocketbase'), 'image'))
})
