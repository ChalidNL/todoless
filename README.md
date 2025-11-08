# Todoless

A modern, multi-user todo list and task management application with workflows, labels, and calendar views.

## Features

- 🔐 **Secure Authentication**: JWT-based auth with optional 2FA, invite-only registration
- 👥 **Multi-user**: Adult and child roles with permission controls
- 📋 **Flexible Organization**: Labels, lists, workflows, and custom attributes
- 📅 **Calendar & Planning**: Due dates, repeating tasks, and calendar view
- 🎯 **Multiple Views**: List, kanban, calendar, and custom saved views
- 🌙 **Theming**: Per-user theme colors and dark mode ready
- 📱 **Responsive**: Works on desktop, tablet, and mobile
- 🏠 **Self-hosted**: Run locally or on your homelab with Docker

## Quick Start

### Development (Windows)

1. **Install dependencies:**
   ```powershell
   npm install
   cd server
   npm install
   ```

2. **Start API:**
   ```powershell
   cd server
   $env:JWT_SECRET = "dev-secret"
   $env:CORS_ORIGIN = "http://localhost:5173"
   npm run dev
   ```

3. **Start frontend:**
   ```powershell
   npm run dev
   ```

4. **Visit:** http://localhost:5173
   - Default login: `admin` / `admin123`

### Production (Docker Compose)

```bash
# Edit docker-compose.yml environment variables first
docker compose up -d
```

Access at http://localhost:8080

### CasaOS Deployment

See [CASAOS-INSTALL.md](./CASAOS-INSTALL.md) for detailed homelab installation instructions.

## Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite for build
- TailwindCSS for styling
- Dexie (IndexedDB) for local data
- Zustand for state management

**Backend:**
- Node.js + Express + TypeScript
- SQLite with better-sqlite3
- JWT authentication (httpOnly cookies)
- bcrypt for password hashing
- Optional 2FA with TOTP

**Deployment:**
- Docker + Docker Compose
- Nginx for static serving
- Multi-stage builds for optimized images

## Documentation

- [Server Development Guide](./SERVER-DEV.md) - Windows/Node setup
- [CasaOS Installation](./CASAOS-INSTALL.md) - Homelab deployment
- [Copilot Instructions](./.github/copilot-instructions.md) - Project conventions

## Default Credentials

**Admin User:**
- Username: `admin`
- Password: `admin123`

⚠️ **Change immediately after first login!**

## Security Features

- Invite-only registration (open registration disabled)
- Admin-approved password resets
- Rate-limited login attempts
- httpOnly JWT cookies with SameSite protection
- Optional two-factor authentication (TOTP)
- Role-based access control (adult/child)

## Environment Variables

### Backend (API)

| Variable       | Default            | Description                          |
|----------------|--------------------|--------------------------------------|
| PORT           | 4000               | API server port                      |
| JWT_SECRET     | dev-secret         | Secret for JWT signing (CHANGE!)     |
| CORS_ORIGIN    | http://localhost:5173 | Allowed frontend origins (comma-separated) |
| COOKIE_SECURE  | auto (prod=true)   | Set false for HTTP, true for HTTPS   |
| DB_PATH        | ./data/family.db   | SQLite database file path            |
| NODE_ENV       | development        | Set to 'production' for prod         |

### Frontend

| Variable       | Default                      | Description                    |
|----------------|------------------------------|--------------------------------|
| VITE_API_URL   | http://\<hostname\>:4000     | API base URL (auto-detected)   |

## Contributing

This is a personal/family project. Feel free to fork for your own use.

## License

MIT (or your preferred license)

## Acknowledgments

Built with modern web technologies and designed for family organization.
