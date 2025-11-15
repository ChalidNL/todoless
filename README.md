# TodoLess

<p align="center">
  <img src="public/icons/todoless-bw.svg" alt="TodoLess Logo" width="128" height="128">
</p>

Modern multi-user task management with workflows, labels, and real-time sync.

## Features

- **Smart Task Management**: Create, organize, and track tasks with rich metadata
- **Labels & Workflows**: Categorize tasks with labels and manage workflows with custom stages
- **Saved Views**: Create custom views with filters (labels, assignees, due dates, workflows)
- **Hierarchical Subviews**: Organize views with parent-child relationships
- **My Tasks View**: Dedicated view for tasks assigned to you
- **Repeat Tasks**: Set tasks to repeat daily, weekly, monthly, or yearly
- **Real-time Sync**: Server-side sync with SSE (Server-Sent Events)
- **Multi-user Support**: Team collaboration with task assignments
- **Notes & Archive**: Reference notes and archived task management
- **Bulk Import**: Import multiple tasks at once with labels
- **Offline-first**: Works offline with IndexedDB, syncs when online

## Quick Start

### Docker Compose (Production)

1. **Create environment file** `.env`:
   ```env
   JWT_SECRET=your-strong-random-secret-here
   CORS_ORIGIN=http://your-server:5174
   ```

2. **Deploy**:
   ```bash
   docker compose up -d
   ```

3. **Access**: http://your-server:5174
   - Default login: `admin` / `admin123` (⚠️ change immediately!)

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   cd server && npm install && cd ..
   ```

2. **Create `server/.env`:**
   ```env
   JWT_SECRET=dev-secret
   CORS_ORIGIN=http://localhost:5174
   DB_PATH=./data/todoless.db
   COOKIE_SECURE=false
   PORT=4000
   ```

3. **Start backend** (in one terminal):
   ```bash
   cd server
   npm run dev  # Runs on :4000
   ```

4. **Start frontend** (in another terminal):
   ```bash
   npm run dev  # Runs on :5174
   ```

5. **Access**: http://localhost:5174

## Architecture

**Frontend:**
- React 18 + TypeScript + Vite
- TailwindCSS for styling
- Dexie.js for IndexedDB (offline-first)
- Zustand for global state management
- React Router for navigation

**Backend:**
- Node.js + Express + TypeScript
- SQLite with better-sqlite3
- JWT authentication with httpOnly cookies
- bcrypt password hashing + optional 2FA (TOTP)
- Server-Sent Events (SSE) for real-time sync

**Deployment:**
- Docker with nginx reverse proxy
- Named volume for persistent SQLite database
- Single-port setup (nginx proxies /api to backend)

## Version History

### v0.0.2 (Current)
- Hierarchical subviews with parent-child relationships
- Expand/collapse functionality for nested views
- My Tasks view (tasks assigned to you)
- Yearly repeat option
- Archive bulk delete (completed tasks & archived notes)
- Full English translation

### v0.0.1
- Initial release with core task management
- Labels, workflows, and saved views
- Real-time sync and multi-user support

## License

MIT

---

Built with ❤️ using React, TypeScript, and SQLite
