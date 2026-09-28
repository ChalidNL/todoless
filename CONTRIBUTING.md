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
- The `dev`, `beta`, and `red` branches are retired for public contribution and release flow. Do not target new PRs at them and do not rely on them for Docker tags.
- Every push to `main` builds the moving `:latest` images plus immutable `:<commit-sha>` images.
- Release tags named `vX.Y.Z` or `vX.Y.Z-prerelease` build immutable semver images without the leading `v`. Stable `vX.Y.Z` tags also publish a `:X.Y` line tag.
- Production installs should pin a release tag, semver line tag, commit SHA tag, or digest. `:latest` is convenient for fresh installs and demos, not a production pin.

## Development setup

```bash
git clone https://github.com/ChalidNL/todoless.git
cd todoless
npm install
cp .env.example .env  # edit as needed
npm run dev            # frontend dev server
```

The repo ships one `docker-compose.yml`, used both for production and local use — it pulls the pre-built PocketBase image, so it's the fastest way to get a backend running locally while you iterate on the frontend with `npm run dev`:
```bash
docker compose up -d pocketbase
```
There is no separate dev compose file. If you need to test frontend + backend together in containers, run the full stack the same way production does (see [README Quick Start](README.md#quick-start)).

## Database migrations

PocketBase applies `pb_migrations/*.js` in lexical file-name order and records applied files by **file name** in its SQLite `_migrations` table. That has two consequences:

- **Every migration gets a unique three-digit prefix** — never duplicate or reuse a number. `010_foo.js` is only applied once; a second `010_bar.js` would be skipped on installs that already ran the first one, or crash on re-run after a rename.
- **NEVER RENAME an applied migration** (GH#34). PocketBase would treat the new file name as a never-applied migration and re-run it, crashing (e.g. "Collection name must be unique") or silently re-applying.

So: append new migrations with the next free number, and leave existing files alone. If a rename is truly unavoidable, append an `old_name|current_name` entry to `MIGRATION_RENAMES` in `pocketbase-entrypoint.sh` (append-only, keep the existing order) — the entrypoint renames the `_migrations` rows and removes the stale file before PocketBase starts.

## Quality checks

Before submitting a PR, run:
```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Commit messages

Keep them short and descriptive. Dutch or English is fine. Reference issue numbers with `#123`.

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0](LICENSE). This keeps todoless open and free — for everyone, forever.
