# Deployment Environments

Todoless uses a structured deployment pipeline with four distinct environments.

## Environment Overview

| Environment | Purpose | Port | Compose File | Auto-deploy |
|------------|---------|------|--------------|-------------|
| **Development** | Local coding with hot-reload | 5174 | `docker-compose.dev.yml` (copy from archive/) | No |
| **Integration** | Automated CI testing | 5174 | `docker-compose.integration.yml` (copy from archive/) | Yes (on PR) |
| **Staging** | Pre-production testing | 5175 | `docker-compose.staging.yml` (copy from archive/) | Yes (on merge to main) |
| **Production** | Live deployment | 5174 | `docker-compose.yml` (canonical, committed) | Yes (on release tag) |

**Note**: Only `docker-compose.yml` is committed to the repository. Other environment-specific compose files are available as examples in `archive/` and should be copied locally as needed.

---

## Development

**Purpose**: Local development with instant hot-reload

**Setup**:
```bash
# Native (recommended for fast iteration)
cd server && npm run dev  # Terminal 1: Backend on :4000
npm run dev               # Terminal 2: Frontend on :5174

# Docker (production-like testing)
docker-compose -f docker-compose.dev.yml up --build
```

**Access**: http://localhost:5174

**Database**: Local SQLite in `server/data/todoless.db`

**Environment**: `server/.env` with `NODE_ENV=development`

---

## Integration

**Purpose**: Automated testing in CI pipeline

**Trigger**: GitHub Actions on pull request

**Setup**:
```bash
# Copy example compose
cp archive/docker-compose.integration.yml.example docker-compose.integration.yml

# Manually (for local integration testing)
TAG=pr-123 docker-compose -f docker-compose.integration.yml up -d

# Run tests against integration environment
npm test
docker-compose -f docker-compose.integration.yml down -v
```

**Access**: http://localhost:5174 (ephemeral)

**Database**: Temporary volume (destroyed after tests)

**Environment**: Hardcoded test credentials, `NODE_ENV=test`

**Lifecycle**: Created per-PR, destroyed after tests complete

---

## Staging

**Purpose**: Pre-production validation with real-world data

**Trigger**: Auto-deploy on merge to `main` branch

**Setup**:
```bash
# Copy example compose
cp archive/docker-compose.staging.yml.example docker-compose.staging.yml

# Deploy staging
docker-compose -f docker-compose.staging.yml up -d

# Update staging to latest main
docker-compose -f docker-compose.staging.yml pull
docker-compose -f docker-compose.staging.yml up -d
```

**Access**: http://your-server:5175

**Database**: Persistent volume `todoless-staging-data` (reset periodically)

**Environment**: 
- `JWT_SECRET` from environment variable
- `NODE_ENV=staging`
- Separate port (5175) to run alongside production

**Notes**:
- Mirrors production configuration
- Used for final QA before release
- Can run on same server as production (different ports)

---

## Production

**Purpose**: Live stable deployment for end users

**Trigger**: Manual deploy or auto-deploy on git tag `v*.*.*`

**Setup**:
```bash
# Initial deployment
cp .env.example .env
# Edit .env and set strong JWT_SECRET
docker-compose up -d

# Update to new release
docker-compose pull
docker-compose up -d

# Rollback to specific version
TAG=v1.2.3 docker-compose up -d
```

**Access**: http://your-server:5174

**Database**: Persistent volume `todoless-data` (NEVER deleted)

**Environment**:
- `JWT_SECRET` from `.env` file (REQUIRED, keep secret)
- `NODE_ENV=production` (optional, defaults in code)
- CORS configured for LAN deployment

**Backup**:
```bash
# Backup database
docker cp todoless-backend:/app/data/todoless.db ./backup-$(date +%Y%m%d).db

# Restore database
docker cp ./backup-20251109.db todoless-backend:/app/data/todoless.db
docker-compose restart todoless-backend
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

```
┌─────────────┐
│  Pull Request│
└──────┬──────┘
       │
       ├─> Build images (multi-arch)
       ├─> Deploy to Integration
       ├─> Run automated tests
       └─> Report results
       
┌─────────────┐
│ Merge to main│
└──────┬──────┘
       │
       ├─> Build & tag images (latest)
       ├─> Deploy to Staging
       └─> Notify team
       
┌─────────────┐
│  Git Tag v*.│
└──────┬──────┘
       │
       ├─> Build & tag images (version + latest)
       ├─> Create GitHub Release
       ├─> Deploy to Production (manual approval)
       └─> Notify stakeholders
```

### Image Tagging Strategy

- **latest**: Most recent build from `main` branch
- **v1.2.3**: Specific semantic version release
- **sha-abc123**: Git commit SHA for precise tracking
- **pr-42**: Pull request specific build for integration testing

---

## Environment Variables

### Required (Production)
```env
JWT_SECRET=your-strong-random-secret-here  # REQUIRED
```

### Optional (All environments)
```env
CORS_ORIGIN=http://192.168.1.100:5174      # Default: *
DB_PATH=/app/data/todoless.db              # Default: shown
COOKIE_SECURE=false                        # Default: false (true in HTTPS prod)
NODE_ENV=production                        # Auto-detected
PORT=4000                                  # Default: 4000 (backend)
```

---

## Health Checks

All environments include health checks:

**Frontend**: 
- Endpoint: `http://localhost/` (nginx root)
- Frequency: 30s
- Timeout: 5s

**Backend**:
- Endpoint: `http://localhost:4000/api/health`
- Frequency: 30s
- Timeout: 5s
- Returns: `{"ok":true}`

**Monitoring**:
```bash
# Check container health
docker ps

# View health check logs
docker inspect todoless-backend | jq '.[0].State.Health'
```

---

## Troubleshooting

### Integration tests failing
```bash
# Check integration logs
docker-compose -f docker-compose.integration.yml logs

# Rebuild with fresh state
docker-compose -f docker-compose.integration.yml down -v
docker-compose -f docker-compose.integration.yml up --build -d
```

### Staging/Production won't start
```bash
# Check if JWT_SECRET is set
docker-compose config | grep JWT_SECRET

# View startup logs
docker-compose logs todoless-backend

# Verify network connectivity
docker-compose exec todoless-backend wget -q -O - http://localhost:4000/api/health
```

### Database migration needed
```bash
# Backup first!
docker cp todoless-backend:/app/data/todoless.db ./backup.db

# Apply migration (example - replace with actual migration)
docker-compose exec todoless-backend node scripts/migrate.js

# Verify migration
docker-compose logs todoless-backend
```

---

## Security Checklist

- [ ] Change default admin password immediately
- [ ] Set strong random JWT_SECRET in production
- [ ] Use HTTPS in public deployments (reverse proxy like Caddy/Traefik)
- [ ] Enable COOKIE_SECURE=true when using HTTPS
- [ ] Restrict CORS_ORIGIN to specific domains if needed
- [ ] Regular database backups (automated cron recommended)
- [ ] Keep Docker images updated (subscribe to GitHub releases)
- [ ] Monitor logs for suspicious activity
- [ ] Review user invites and permissions periodically

---

## Maintenance

### Regular Tasks
- Weekly: Review logs for errors
- Monthly: Update to latest release
- Quarterly: Database backup verification
- Yearly: Review and rotate secrets (JWT_SECRET)

### Updating
```bash
# Check for updates
git fetch --tags
git tag -l | tail -5

# Update to specific version
TAG=v1.3.0 docker-compose pull
docker-compose up -d

# Verify update
docker-compose logs | grep "server:listening"
```
