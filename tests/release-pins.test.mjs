// #263 / GH#47: docker-compose.yml must pin both images to one published
// build by digest. The v1.0.0 compose pinned ':1.0.0' by tag while that tag
// had been built from the first commit of the release branch - the images
// carried none of the release and nothing noticed. A digest pin names an
// exact build; scripts/pin-release-images.py moves it and prints the commit
// the images were built from.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const root = new URL('../', import.meta.url)
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8')

const LINE = /^\s*image:\s*ghcr\.io\/chalidnl\/(todoless-frontend|todoless-pocketbase)(?::([^@\s]+))?(?:@(sha256:[0-9a-f]{64}))?\s*$/
const pins = {}
for (const line of read('docker-compose.yml').split('\n')) {
  const m = LINE.exec(line)
  if (m) pins[m[1]] = { ref: m[2] || 'latest', digest: m[3] || '' }
}

test('both images are present, pinned to the same ref, and the ref names one build', () => {
  assert.deepEqual(Object.keys(pins).sort(), ['todoless-frontend', 'todoless-pocketbase'])
  const refs = new Set(Object.values(pins).map((p) => p.ref))
  assert.equal(refs.size, 1, `images pinned to different refs: ${[...refs].join(', ')}`)
  const ref = [...refs][0]
  const version = JSON.parse(read('package.json')).version
  // A release version must be the one package.json carries (the tag guard in
  // docker-publish.yml ties that version to main's head); a commit pin must
  // be the full sha. ':latest' or a line tag (1.0) is not a build.
  assert.ok(ref === version || /^[0-9a-f]{40}$/.test(ref), `ref '${ref}' is neither package.json's version (${version}) nor a 40-char commit sha`)
})

test('a commit pin carries its digest; a release pin gets one after the build (pin script)', () => {
  for (const [image, pin] of Object.entries(pins)) {
    if (/^[0-9a-f]{40}$/.test(pin.ref)) {
      assert.match(pin.digest, /^sha256:[0-9a-f]{64}$/, `${image}: a commit pin without its digest is not immutable (run scripts/pin-release-images.py)`)
    }
    if (pin.digest) assert.match(pin.digest, /^sha256:[0-9a-f]{64}$/)
  }
})

test('the release steps and the pin script are documented for maintainers', () => {
  assert.match(read('CONTRIBUTING.md'), /pin-release-images\.py/)
  assert.match(read('.github/workflows/docker-publish.yml'), /main's current head|is not main's head/)
})
