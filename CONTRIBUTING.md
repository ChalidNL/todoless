# Contributing to todoless

Thanks for your interest in contributing! todoless is family data software — please keep **privacy and simplicity** front of mind in every contribution.

## Guiding principles

- **Privacy first.** Never collect, track, or transmit user data without explicit, informed consent. If a feature would require phoning home, it doesn't belong.
- **Simplicity wins.** Families use this on phones between breakfast and school drop-off. The UI should be calm, clear, and mobile-first.
- **Free forever.** No paywalls, no premium tiers. Every feature is available to everyone, always.
- **Self-hosted.** The code runs on the user's hardware. Avoid dependencies on external services where possible.

## How to contribute

1. **Issues** — Bug reports and feature ideas are welcome. Search existing issues first.
2. **Pull requests** — Fork, create a short-lived feature/fix branch, make your change, and open a PR against `main`. Keep PRs focused — one thing, well done.
3. **Help & questions** — For questions, ideas, or help, open an [issue](https://github.com/ChalidNL/todoless/issues) (GitHub Discussions is disabled for this repository).

## Branch and release model

- `main` is the only integration branch and the source of truth.
- Short-lived feature/fix branches are merged into `main` by PR after the quality gates pass.
- The old `dev` branch is retired: target `main`, and don't rely on it for Docker tags.
- Every push to `main` builds the moving `:latest` images plus immutable `:<commit-sha>` images.
- Release tags named `vX.Y.Z` or `vX.Y.Z-prerelease` build immutable semver images without the leading `v`. Stable `vX.Y.Z` tags also publish a `:X.Y` line tag.
- Production installs should pin a release tag, semver line tag, commit SHA tag, or digest. `:latest` is convenient for fresh installs and demos, not a production pin.
- Releasing (#263): bump `package.json` on `main`, merge, then tag **that merge commit** `vX.Y.Z` — `docker-publish` refuses a release tag that is not `main`'s current head or whose version differs from `package.json`. Once the `:X.Y.Z` images exist, run `python3 scripts/pin-release-images.py X.Y.Z` and commit the `docker-compose.yml` it writes: both images pinned by digest, with the commit each image was built from printed next to it (`--check` verifies the current pins). `tests/release-pins.test.mjs` keeps compose on one build and in step with `package.json`.

## Development setup

You need Node.js 22 and the [PocketBase 0.40.4](https://github.com/pocketbase/pocketbase/releases/tag/v0.40.4) binary for your platform.

```bash
git clone https://github.com/ChalidNL/todoless.git
cd todoless
npm install

# Backend: PocketBase with this repo's hooks and migrations (data in ./pb_data, git-ignored)
./pocketbase serve --http=127.0.0.1:8091 --dir=./pb_data \
  --migrationsDir=./pb_migrations --hooksDir=./pb_hooks

# Frontend, in a second terminal: http://localhost:7071 (proxies /api to localhost:8091)
npm run dev
```

Open the app and complete the onboarding to create your first account. Set `TODOLESS_API_PROXY` if PocketBase runs on another address.

To test the production containers instead, run the full stack as described in the [README Quick Start](README.md#quick-start).

## Working with a copy of real data

Never develop against a production database. If you need realistic data, make an anonymized copy:

```bash
docker compose stop pocketbase   # or use a backup zip from pb_data/backups
python3 scripts/anonymize-prod-to-dev.py /path/to/prod/pb_data/data.db ./pb_data/data.db
```

- The script replaces names, e-mail addresses, passwords (all become `test1234`; the first user and the first superuser are `admin@example.test`), titles and free text. It deletes tokens, invites, integrations and push data, and clears external calendar identifiers.
- It rewrites the PocketBase settings: SMTP, S3 and backup S3 are disabled and their credentials removed. If the settings are encrypted (`ENCRYPTION_KEY`), the row is deleted and PocketBase recreates safe defaults. Token-signing secrets are rotated.
- The output only appears once anonymization has fully succeeded. After an error no output file is left behind.
- **Copy only `data.db`.** `pb_data/auxiliary.db` holds PocketBase's request logs (IP addresses, URLs, e-mail addresses) and is **not** anonymized; PocketBase creates a fresh one. Uploaded files in `pb_data/storage` are not scrubbed either.
- Never commit any database file, anonymized or not.

## Database migrations

PocketBase applies `pb_migrations/*.js` in lexical file-name order and records applied files by **file name** in its SQLite `_migrations` table. That has two consequences:

- **Every migration gets a unique three-digit prefix** — never duplicate or reuse a number. `010_foo.js` is only applied once; a second `010_bar.js` would be skipped on installs that already ran the first one, or crash on re-run after a rename.
- **NEVER RENAME an applied migration** (GH#34). PocketBase would treat the new file name as a never-applied migration and re-run it, crashing (e.g. "Collection name must be unique") or silently re-applying.

So: append new migrations with the next free number, and leave existing files alone. If a rename is truly unavoidable, append an `old_name|current_name` entry to `MIGRATION_RENAMES` in `pocketbase-entrypoint.sh` (append-only, keep the existing order) — the entrypoint renames the `_migrations` rows and removes the stale file before PocketBase starts.

`tests/migration-prefixes.test.mjs` (part of `node --test tests/*.test.mjs` in the quality gate) fails on a new duplicate prefix. The seven duplicates that already shipped (`032`, `039`, `049`, `050`, `z066`, `z067`, `z069`) are frozen in that test because renaming them would re-run them on existing installs; don't add to that list. Note that `z0xx` files sort after every numeric prefix, so on a fresh install `073_…` runs before `z061_…` even though it was written later — keep new migrations independent of that ordering.

## Quality checks

Before submitting a PR, run:
```bash
npm run typecheck
npm run lint
npm test                      # frontend unit tests
node --test tests/*.test.mjs  # backend contract tests
npm run build
```
CI additionally runs a live PocketBase smoke suite (`scripts/pb-smoke.sh`), the migration checks and the Playwright mobile E2E suite (`scripts/e2e.sh`); both scripts download PocketBase themselves.

## Commit messages

Keep them short and descriptive. Dutch or English is fine. Reference issue numbers with `#123`.

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0](LICENSE). This keeps todoless open and free — for everyone, forever.
