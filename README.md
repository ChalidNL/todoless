
# todoless-ngx

`todoless-ngx` is a self-hosted, multi-user productivity app built with React, Vite, and PocketBase.
It is designed for a shared *family* workspace with invite-based onboarding, realtime sync, and a unified model for tasks and items.

## What this project does
- Shared family workspace with roles like owner, admin, member, and agent
- Invite-based registration and onboarding flow
- Unified inbox/backlog and task workflow
- Grocery / item tracking with shops and quantities
- Notes, labels, projects, goals, rewards, and reminders
- Sprint support and calendar events
- PocketBase-backed realtime updates and server-side hooks
- API tokens, shared routes, and PocketBase migrations for the backend logic

## Tech stack
- Frontend: React 18 + Vite 6
- Backend: PocketBase 0.35.x
- UI: Tailwind CSS + Radix UI components
- Runtime: Docker / Docker Compose

## Local development

### Prerequisites
- Node.js 20+ and npm
- Docker + Docker Compose

### Environment
Start from the example file:

```bash
cp .env.example .env
```

Then fill in the values you need for your local setup.

### Run the dev stack
Use the development compose file:

```bash
docker compose -f docker-compose.dev.yml up --build
```

This starts the frontend and PocketBase locally.

### Frontend-only workflow
If the backend is already running elsewhere, you can work on the frontend with Vite directly:

```bash
npm install
npm run dev
```

## Quality checks
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run mcp:build`
- `npm run security:secrets`

## TodoLess MCP server

The MCP server is a thin TypeScript layer over the existing PocketBase API. It uses one PocketBase user token per instance; no admin token or service-account authority is required or used.

Environment:
- `TODOLESS_PB_URL` — internal PocketBase URL, e.g. `http://pocketbase:8090`
- `TODOLESS_USER_TOKEN` — PocketBase user auth token
- `TODOLESS_MCP_TRANSPORT` — `stdio` or `http`
- `TODOLESS_MCP_READONLY` — defaults to `true`; write tools are not registered when enabled
- `TODOLESS_MCP_RATE_LIMIT` — mutating calls per minute
- `TODOLESS_MCP_HTTP_PORT` — default `3333`

Local stdio example:

```bash
TODOLESS_PB_URL=http://127.0.0.1:8090 \
TODOLESS_USER_TOKEN='<pb-user-token>' \
TODOLESS_MCP_TRANSPORT=stdio \
npm run mcp:build && npm run mcp:start
```

HTTP mode is intended for the compose stack behind the same TLS reverse proxy as the app. The compose service exposes port `3333` only on the internal Docker network; it does not publish the MCP server directly.

## Deployment
- Production and development images are defined in `docker-compose.yml` and `docker-compose.dev.yml`
- Backend hooks and migrations live in `pb_hooks/` and `pb_migrations/`

## Security baseline
- Keep real secrets out of git; use `.env` locally or a secret manager
- Use `.env.example` as the template for new environments

## Repository layout
- `src/` — React app, views, components, context, and shared utilities
- `pb_hooks/` — PocketBase server-side routes and business logic
- `pb_migrations/` — schema and data migrations
- `scripts/` — deployment and maintenance helpers
- `e2e/` — end-to-end checks

## Notes
- This repo is meant for self-hosted use
- The app relies on PocketBase for auth, data storage, and realtime subscriptions
  

## Live readiness notes
- Terminate TLS in front of the app with a reverse proxy such as Caddy, Traefik, or Nginx Proxy Manager before exposing it publicly. The app container intentionally does not emit HSTS on plain HTTP; set HSTS only at the TLS terminator.
- Keep the frontend production build same-origin: leave `VITE_POCKETBASE_URL` empty so API calls go through `/api`. Do not build customer-facing images with `localhost` PocketBase URLs.
- PocketBase is intentionally not published directly; access it through the frontend nginx proxy. The proxy forwards `X-Forwarded-*` headers for logging/rate limiting.
- Validate SMTP before go-live by running the invite/password-reset flow end-to-end.
- Use PocketBase backup/export or a SQLite-safe backup method for `pb_data`; do not rely on raw file copies while the database is writing.
- Pin release images or digests for production installs; `:latest`/`:dev` are for CasaOS/dev convenience and not reproducible release artifacts.
