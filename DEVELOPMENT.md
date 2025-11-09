# Local Development Guide

## Quick Start (Native - Recommended for Development)

### Prerequisites
- Node.js 20+
- npm or pnpm

### 1. Backend Setup
```powershell
cd server
npm install
npm run dev
```
Backend runs on http://localhost:4000

### 2. Frontend Setup (separate terminal)
```powershell
npm install
npm run dev
```
Frontend runs on http://localhost:5173

### Environment Variables
Create `.env` in project root:
```env
# No VITE_API_URL needed for dev (uses localhost:4000 fallback)
```

Create `server/.env`:
```env
JWT_SECRET=dev-secret-change-in-production
CORS_ORIGIN=http://localhost:5174,http://localhost:3000
DB_PATH=./data/todoless.db
COOKIE_SECURE=false
NODE_ENV=development
PORT=4000
```

### Default Credentials
- Username: `admin`
- Password: `admin123`

---

## Docker Development (Production-like)

### Build and Run with Docker Compose
```powershell
# Copy example compose for local development
Copy-Item archive\docker-compose.dev.yml.example docker-compose.dev.yml

# Build and start both containers
docker-compose -f docker-compose.dev.yml up --build

# Stop
docker-compose -f docker-compose.dev.yml down

# Rebuild after changes
docker-compose -f docker-compose.dev.yml up --build --force-recreate
```

**Note**: `docker-compose.dev.yml` is not committed to git. Copy from `archive/docker-compose.dev.yml.example` as needed.

Access at: http://localhost:5174

### View Logs
```powershell
# All services
docker-compose -f docker-compose.dev.yml logs -f

# Backend only
docker-compose -f docker-compose.dev.yml logs -f todoless-backend-dev

# Frontend only
docker-compose -f docker-compose.dev.yml logs -f todoless-frontend-dev
```

---

## Development Workflow

### Making Changes

#### Frontend Changes
1. Edit files in `src/`
2. **Native dev**: Vite hot-reloads automatically
3. **Docker dev**: Rebuild with `docker-compose -f docker-compose.dev.yml up --build todoless-frontend-dev`

#### Backend Changes
1. Edit files in `server/src/`
2. **Native dev**: tsx watch auto-restarts
3. **Docker dev**: Rebuild with `docker-compose -f docker-compose.dev.yml up --build todoless-backend-dev`

### Building for Production
```powershell
# Frontend
npm run build
# Output: dist/

# Backend
cd server
npm run build
# Output: server/dist/
```

### Testing Locally Before Push
```powershell
# Use dev compose to test full stack
docker-compose -f docker-compose.dev.yml up --build

# Or test individual builds
docker build -t todoless-frontend-test .
docker build -t todoless-backend-test ./server
```

Access at: http://localhost:5174

---

## Troubleshooting

### Port conflicts
If ports 3000 or 4000 are in use, edit `docker-compose.dev.yml` or stop conflicting processes.

### Database reset
```powershell
# Native
Remove-Item server/data/todoless.db

# Docker
docker-compose -f docker-compose.dev.yml down -v
```

### CORS errors in native dev
Ensure `server/.env` has:
```env
CORS_ORIGIN=http://localhost:5174
```

### Frontend can't reach backend
Native dev: Backend must be running on port 4000
Docker dev: Services must be on same network (already configured)

---

## Production Deployment
See main `docker-compose.yml` for CasaOS/production setup.
