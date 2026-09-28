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

The repo ships one `docker-compose.yml`, used both for production and local use — it pulls the pre-built PocketBase image, so it's the fastest way to get a backend running locally while you iterate on the frontend with `npm run dev`:
```bash
docker compose up -d pocketbase
```
There is no separate dev compose file. If you need to test frontend + backend together in containers, run the full stack the same way production does (see [README Quick Start](README.md#quick-start)).

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
