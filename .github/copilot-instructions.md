## Architecture Overview
- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS. Entry: `src/App.tsx`. Pages are lazy-loaded from `src/pages/`. State managed via Zustand. IndexedDB via Dexie (`src/db/dexieClient.ts`).
- **Backend**: Node.js + Express + TypeScript. Entry: `server/src/index.ts`. SQLite (better-sqlite3) for persistence. Auth via JWT, bcrypt, en optionele TOTP 2FA. API routes modulair in `server/src/` (zoals `auth.ts`, `tasks.ts`, `labels.ts`).
- **Deployment**: Docker Compose met nginx reverse proxy. Zie `docker-compose.yml` en `nginx.conf`.

## Developer Workflows
- **Local Development**:
  - Backend: `cd server && npm install && npm run dev` (draait op :4000)
  - Frontend: `npm install && npm run dev` (draait op :5174)
  - Environment: Maak `server/.env` aan (zie README voor variabelen)
- **Production**:
  - Gebruik Docker Compose. Zet `JWT_SECRET` en `CORS_ORIGIN` in `.env`.
  - Persistente data in Docker volume `todoless-data` → `/app/data`.
- **Testing**:
  - Backend: `cd server && npm run test` (Vitest)
  - Test-only admin user seeded in non-production (`admin`/`admin123`).

## Project-Specific Conventions
- **Frontend**:
  - Pagina's/components lazy-loaded voor performance.
  - State: Zustand voor global state, Dexie voor lokale DB.
  - Routing: React Router, protected/admin routes via `ProtectedRoute`/`AdminRoute`.
  - Filters, sortering en view modes via context providers (`src/contexts/`).
- **Backend**:
  - Modulaire route files: `authRouter`, `tasksRouter`, `labelsRouter`.
  - CORS: `CORS_ORIGIN` kan comma-separated of `*` zijn voor LAN/dev.
  - Security: Helmet met relaxed CSP voor LAN/dev; strict in productie.
  - Logging: Custom logger in `server/src/logger.ts`.
  - Healthcheck: `/api/health` endpoint voor Docker health.
- **Data**:
  - SQLite DB op `server/data/todoless-server.db` (of `/app/data` in Docker).
  - Dexie schema in `src/db/schema.ts`.

## Integration Points & Patterns
- **Frontend ↔ Backend**: REST API, geproxied via nginx (`/api` → backend:4000).
- **Auth**: JWT in cookies, 2FA via TOTP (zie `server/src/auth.ts`).
- **Real-Time**: Event system in `server/src/events.ts` (add/remove client).
- **Icons/Assets**: Vanuit `public/icons/` en `server/public/assets/icons/`.

## Voorbeelden
- Nieuwe API route toevoegen: Maak een router in `server/src/`, importeer en gebruik in `index.ts`.
- Nieuwe pagina toevoegen: Maak in `src/pages/`, lazy-load in `App.tsx`.
- Dexie schema uitbreiden: Update `src/db/schema.ts` en `dexieClient.ts`.

## Referenties
- Zie `README.md` voor setup en environment details.
- Zie `docker-compose.yml` voor deployment config.
- Zie `server/package.json` en `package.json` voor scripts.

---

Feedback of onduidelijkheden? Geef aan zodat deze instructies verbeterd kunnen worden.
