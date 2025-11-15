# ![Todoless Logo](https://raw.githubusercontent.com/ChalidNL/todoless/main/public/icons/todoless-bw.svg) Todoless

Modern multi-user task management with workflows and real-time sync.

## Features


## Quick Start

### Docker Compose (Production)

1. **Create environment file** `.env`:
   ```env
   JWT_SECRET=your-strong-random-secret-here
   ```

2. **Deploy**:
   ```bash
   docker compose up -d
   ```

3. **Access**: http://your-server:5174
   - Default login: `admin` / `admin123` (change immediately!)

### Local Development

**Backend**:
```bash
cd server
npm install
npm run dev  # Runs on :4000
```

**Frontend** (new terminal):
```bash
npm install
npm run dev  # Runs on :5174
```

Create `server/.env`:
```env
JWT_SECRET=dev-secret
CORS_ORIGIN=http://localhost:5174
DB_PATH=./data/todoless.db
COOKIE_SECURE=false
PORT=4000
```

## Architecture

- **Frontend**: React + Vite + TypeScript + TailwindCSS
- **Backend**: Node.js + Express + SQLite
- **Deployment**: Docker with nginx reverse proxy

## License

MIT
2. Plak de inhoud van `docker-compose.yml` (main branch)
2. **Compose plakken:**
   ```yaml
   # Paste de volledige docker-compose.yml hier
   ```

3. **Environment variabelen aanpassen:**
   - `JWT_SECRET` = een sterke random waarde (gebruik `openssl rand -base64 32`)
   - `CORS_ORIGIN` = `http://<host>:5174`

4. Deploy → App op `http://<host>:5174` (nginx proxied /api naar backend:4000)

Persistente data: named volume `todoless-data` → `/app/data` (SQLite).

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   cd server && npm install
   ```

2. **Start backend:**
   ```bash
   cd server
   npm run dev
   ```

3. **Start frontend (in new terminal):**
   ```bash
   npm run dev
   ```

4. **Access:** http://localhost:5174

## Tech Stack

**Frontend:**
- React 18 + TypeScript + Vite
- TailwindCSS
- Dexie (IndexedDB)
- Zustand for state management

**Backend:**
- Node.js + Express + TypeScript
- SQLite with better-sqlite3
- JWT authentication
- bcrypt + optional 2FA (TOTP)

## License

MIT
