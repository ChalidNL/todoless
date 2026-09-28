# Contributing to todoless

Thanks for your interest in contributing! todoless is family data software — please keep **privacy and simplicity** front of mind in every contribution.

## Guiding principles

- **Privacy first.** Never collect, track, or transmit user data without explicit, informed consent. If a feature would require phoning home, it doesn't belong.
- **Simplicity wins.** Families use this on phones between breakfast and school drop-off. The UI should be calm, clear, and mobile-first.
- **Free forever.** No paywalls, no premium tiers. Every feature is available to everyone, always.
- **Self-hosted.** The code runs on the user's hardware. Avoid dependencies on external services where possible.

## How to contribute

1. **Issues** — Bug reports and feature ideas are welcome. Search existing issues first.
2. **Pull requests** — Fork, branch, make your change, open a PR against `dev`. Keep PRs focused — one thing, well done.
3. **Discussions** — For questions, ideas, or help, open a [discussion](https://github.com/ChalidNL/todoless/discussions).

## Development setup

```bash
git clone https://github.com/ChalidNL/todoless.git
cd todoless
npm install
cp .env.example .env  # edit as needed
npm run dev            # frontend dev server
```

For the full stack with PocketBase:
```bash
docker compose -f docker-compose.dev.yml up
```

## Quality checks

Before submitting a PR, run:
```bash
npm run typecheck
npm run lint
npm test
npm run build
```

PocketBase migration changes additionally run through the integration smoke
suite (see `scripts/pb-smoke.sh`).

## Database migrations

`pb_migrations/` contains PocketBase migration files. PocketBase applies them
in **lexical file-name order**, so the file name *is* the execution order.

- Every migration file gets a unique three-digit prefix: `001_initial_schema.js`, `002_cross_relations.js`, … `070_enable_scheduled_backups.js`.
- Never duplicate a prefix and never reuse a number — two files sharing a prefix
  make it impossible to tell which runs when.
- To append a new migration, use the next free number: `071_…`, `072_…`, …
- To append a migration without picking a number, use PocketBase's own
  timestamp naming — e.g. `1727000000_description.js` — which sorts lexically
  after every `NNN_` file while staying unique.
- There is no `z`-prefix trick anymore; it was removed when the numbering was
  normalised (GH#38).
- **Never rename an applied migration.** PocketBase tracks applied migrations
  by file name in `_migrations`; renaming a file makes it look brand-new and it
  re-runs on every existing installation (GH#34). If a rename is unavoidable,
  add an `old_name|current_name` entry to the `MIGRATION_RENAMES` map in
  `pocketbase-entrypoint.sh` (the entrypoint then removes the stale file and
  renames the `_migrations` row before PocketBase starts).

## Commit messages

Keep them short and descriptive. Dutch or English is fine. Reference issue numbers with `#123`.

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0](LICENSE). This keeps todoless open and free — for everyone, forever.
