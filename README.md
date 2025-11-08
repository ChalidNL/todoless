# Todoless

A modern, multi-user todo list and task management application with workflows, labels, and calendar views.

## Features

- 🔐 **Secure Authentication**: JWT-based auth with optional 2FA
- 👥 **Multi-user**: Multiple user roles with permission controls
- 📋 **Flexible Organization**: Labels, lists, workflows, and custom attributes
- 📅 **Calendar & Planning**: Due dates, repeating tasks, and calendar view
- 🎯 **Multiple Views**: List, kanban, calendar, and custom saved views
- 🌙 **Theming**: Per-user theme colors and dark mode
- 📱 **Responsive**: Works on desktop, tablet, and mobile
- 🏠 **Self-hosted**: Run locally or on your server with Docker

## Quick Start

### Docker Compose (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ChalidNL/todoless.git
   cd todoless
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env and set a secure JWT_SECRET
   ```

3. **Start the application:**
   ```bash
   docker compose up -d
   ```

4. **Access the app:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000
   - Default login: `admin` / `admin123` (⚠️ Change immediately!)

Images are published automatically to GHCR:

```bash
# pull (optional, compose pulls automatically)
docker pull ghcr.io/chalidnl/todoless-backend:latest
docker pull ghcr.io/chalidnl/todoless-frontend:latest
```

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

## Configuration

Create a `.env` file in the root directory:

```env
JWT_SECRET=your-secure-random-secret-here
CORS_ORIGIN=http://localhost:3000
VITE_API_URL=http://localhost:4000
```

## License

MIT
