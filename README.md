<div align="center">

<img src="docs/assets/logo.png" alt="todoless" width="120" />

# todoless

**The family organizer that keeps your data yours.**

Local-first · Self-hosted · Made in Europe · Free forever — no subscriptions, no paywalls.

[Why todoless](#-why-todoless) · [Quick Start](#-quick-start) · [Configuration](#-configuration) · [Security](#-running-securely) · [Roadmap](#-roadmap)

</div>

---

## Why todoless?

There are thousands of to-do apps. Almost none of them are built around **your privacy**. todoless is.

Family life is full of appointments, reminders and recurring patterns — groceries, school runs, swimming lessons, doctor visits. No app made that calm and clear *without* shipping your family's data to someone else's servers.

todoless is a small gift back to people who just want to organise daily life, on their own terms:

- 🔒 **Your data stays yours.** Self-hosted on your own machine. No tracking, no ads, no profiling.
- 🏠 **Local-first.** Runs on your own server — a Raspberry Pi, an old laptop, a NAS. You own the database.
- 🇪🇺 **Designed and built in Europe**, with data sovereignty as a first principle — not an afterthought.
- 🆓 **Free forever.** No subscriptions. No "premium" tier. Every feature is available to everyone, always.
- 👨‍👩‍👧‍👦 **Made for families.** Shared tasks, groceries, a calendar of everyone's appointments, and recurring routines — in one calm, mobile-first interface.
- 🧩 **Open and yours to shape.** Self-hosted and transparent; you can read the code that runs your family's data.

> todoless was never meant to be a million-dollar business. It's a contribution back — software that respects the people who use it.

---

## Screenshots

| Inbox | Tasks | Calendar |
|---|---|---|
| ![Inbox](docs/assets/screenshot-inbox.png) | ![Tasks](docs/assets/screenshot-tasks.png) | ![Calendar](docs/assets/screenshot-calendar.png) |

| Groceries | Week view | Settings |
|---|---|---|
| ![Groceries](docs/assets/screenshot-groceries.png) | ![Week](docs/assets/screenshot-week.png) | ![Settings](docs/assets/screenshot-settings.png) |

---

## What you get

- **Inbox** — capture anything quickly; sort it later.
- **Tasks** — due dates, recurring patterns, labels, assignees, priorities, focus, subtasks.
- **Calendar** — every task with a date, visualised. Day / 3-day / Week / Work week / Month / Schedule views.
- **Groceries** — a shared shopping list with quantities and shops, for the whole household.
- **Multi-member** — one household, multiple people, shared and personal items. Invite-based onboarding.
- **Mobile-first** — built for phones, where family logistics actually happen.

---

## Quick Start

todoless runs as three Docker containers: **nginx frontend**, **PocketBase backend** (database + auth + API), and an optional **MCP server**. All orchestrated with Docker Compose.

### Requirements
- A machine that can run **Docker** and **Docker Compose** (Linux, Raspberry Pi 4+, NAS, or any always-on computer).
- ~5 minutes.

### 1. Clone
```bash
git clone https://github.com/ChalidNL/todoless.git
cd todoless
```

### 2. Create data directories
PocketBase needs persistent storage. Create the directories Docker will mount:
```bash
sudo mkdir -p /DATA/AppData/todoless/pb_data
sudo mkdir -p /DATA/AppData/todoless/pb_migrations
sudo mkdir -p /DATA/AppData/todoless/pb_hooks
```

> **Custom paths:** If you prefer different locations, edit `docker-compose.yml` and change the volume `source` paths before starting.

### 3. Run
```bash
docker compose up -d
```
This pulls the pre-built images from GitHub Container Registry and starts everything.

### 4. Open
Visit **http://your-server-ip:7070**. On first run, you'll see the onboarding:
1. Choose your language
2. Create your admin account and name your household
3. Invite family members from Settings

---

## Configuration

### Port
The app is exposed on port **7070** by default. To change it, set `TODOLESS_PORT` in `.env` (see `.env.example`):
```yaml
# docker-compose.yml (no edit needed)
ports:
  - target: 80
    published: "${TODOLESS_PORT:-7070}"
```
```bash
# .env
TODOLESS_PORT=8080
```

### Volumes
All persistent data lives in `/DATA/AppData/todoless/`:

| Directory | Purpose |
|---|---|
| `pb_data/` | PocketBase database + file uploads |
| `pb_migrations/` | Schema migration scripts |
| `pb_hooks/` | Server-side API hooks |

### Environment (.env.example)
The `.env.example` file documents available variables. Not all are used by the production compose — the key ones for self-hosters:

| Variable | What it does |
|---|---|
| `TZ` | Timezone (default: `Europe/Amsterdam`) |
| `TODOLESS_PORT` | Published web port, read by compose (default: `7070`, see `.env.example`) |
| `LOG_LEVEL` | Backend logging verbosity on stdout/stderr (default: `info`) — see below |

> Build-time variables (`VITE_POCKETBASE_URL`, `POCKETBASE_ADMIN_*`, SMTP settings) are used when building your own images — not needed when using the pre-built GHCR images.

### Logging & observability
The PocketBase container writes structured, single-line request logs to **stdout/stderr**, which any Docker log setup (Loki/promtail, Dozzle, Portainer, `docker logs`) picks up automatically:

```
[pb-request] ts=2026-09-28T10:45:19Z level=info method=GET path=/api/entries status=200 duration_ms=3 ip=192.168.2.10 auth=abc123
[pb-request] ts=2026-09-28T10:45:19Z level=warn method=POST path=/api/invites/create status=401 duration_ms=1 ip=192.168.2.10 auth=-
```

- `level=info` → stdout · `level=warn`/`level=error` → stderr · `path` is the route only (query string, headers and bodies are **never** logged).
- 4xx/5xx lines are also mirrored into PocketBase's own log store (`auxiliary.db` → `_logs`) via `$app.logger()`, so they show up in the admin dashboard (and can be shipped via the superuser API `GET /api/logs/request`).
- Unhandled errors thrown by custom routes are logged (`level=error ... error="..."`) instead of being silently swallowed.
- `LOG_LEVEL` controls verbosity: `info` (default) logs everything · `warn`/`error` only logs warnings/errors · `debug`/`trace` adds PocketBase's own `--dev` output (console logs + SQL) to the same streams.
- Log retention in `_logs` defaults to 5 days — adjust under **Settings → Logs** in the admin dashboard if you need longer history.

---

## Updating

```bash
cd todoless
git pull
docker compose pull
docker compose up -d
```
PocketBase automatically applies new migrations on restart. Check the [releases page](https://github.com/ChalidNL/todoless/releases) for breaking changes before updating.

### Backups

PocketBase's built-in backup is enabled by default: it creates a **consistent zip snapshot every day at 02:00** (server time) and **keeps the last 7 backups**. Backups live in `pb_data/backups` (on the host: `/DATA/AppData/todoless/pb_data/backups`) and include the database plus all uploaded files. Download or restore them under **Settings → Backups** in the admin dashboard — you can also change the schedule/retention or mirror backups to S3-compatible storage there.

> ⚠️ **Never copy the database while the app is running.** PocketBase uses SQLite in WAL mode: while the app is up there is a `data.db-wal` file holding the most recent writes, so copying `data.db` alone silently loses the last transactions. Use the built-in backup above (transaction-safe, runs while the app is up) or the offline recipe below (stopping PocketBase checkpoints the WAL first):
```bash
# Manual alternative: stop PocketBase first for a clean copy
docker compose stop pocketbase
sudo cp -r /DATA/AppData/todoless/pb_data /backup/pb_data-$(date +%Y%m%d)
docker compose start pocketbase
```
> **Your data, your responsibility — and your control.**

---

## Running securely

todoless is meant to live on your own network. Here's how to access it safely:

### Option A: Tailscale (recommended for families)
Install [Tailscale](https://tailscale.com) on your server and your devices. Access todoless at `http://your-server:7070` — private, encrypted, nothing exposed to the internet.

### Option B: Reverse proxy + HTTPS
If you want a public domain, put todoless behind a reverse proxy with HTTPS:

| Proxy | Setup |
|---|---|
| **Caddy** | `your.domain { reverse_proxy localhost:7070 }` |
| **Traefik** | Add labels to the compose service |
| **nginx + Let's Encrypt** | Standard reverse proxy with certbot |

> ⚠️ **Important:** If you use a reverse proxy, configure it to terminate TLS. The todoless container only serves HTTP — do not expose port 7070 directly to the internet without HTTPS in front of it.

### Security hardening
- The PocketBase backend is not published to the host — only accessible internally via the nginx proxy.
- Frontend container runs **read-only** with minimal privileges.
- PocketBase container drops all capabilities except what it needs (`CHOWN`, `DAC_OVERRIDE`).
- Use `:latest` or `:dev` tags for convenience; pin to specific digests in production.
- Validate SMTP before going live (invite/password-reset emails).

---

## Tech stack
- **Frontend:** React 18 + Vite 6 + Tailwind CSS
- **Backend:** PocketBase 0.35 (SQLite + auth + REST API + realtime)
- **Deployment:** Docker Compose, pre-built GHCR images
- **Privacy:** everything runs on your hardware

---

## Roadmap
- [x] Multilingual UI (NL / FR / EN / DE / ES)
- [x] Calendar import/export (.ics)
- [ ] Recurring "family run" weekly planning ritual
- [ ] Push notifications (mobile)
- [ ] Companion mobile app (Android)

*See the [issues](https://github.com/ChalidNL/todoless/issues) for details.*

---

## Contributing
todoless is built in the open. Issues, ideas and pull requests are welcome. Because this is family data software, please keep **privacy and simplicity** front of mind in any contribution.

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License
todoless is licensed under the **[GNU Affero General Public License v3.0](LICENSE)** (AGPL-3.0).

This keeps the code open and free — for everyone, forever. If you modify todoless and make it available over a network (including self-hosting modifications), you must share your changes under the same license. That's how we protect the community.

---

<div align="center">

**todoless** — organise family life, keep your privacy.
Made in Europe. Your data stays home.

</div>
