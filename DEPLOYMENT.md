# todoless-ngx Deployment Guide

## Environment Architecture

| Environment | Host | Branch | Docker Tag | Compose File | Purpose |
|---|---|---|---|---|---|
| **Dev** | `192.168.2.150` | `dev` | `:dev` | `docker-compose.dev.yml` | Active development & testing |
| **Main** | `192.168.2.100` | `main` | `:latest` | `docker-compose.yml` | Stable production |

## Branch Strategy

```
main ← stable, protected
  ↑ merge only after validation
dev  ← active development
  ↑ feature branches merged here
feature/* ← isolated work
```

### Rules

1. **`main` is sacred** — never push directly except for:
   - Version bumps, hotfixes (must be merged back to dev)
   - Documentation-only changes
2. **`dev` is active** — all feature work merges here first
3. **Feature branches** — `feature/description` format, short-lived
4. **No direct commits to `main`** from feature work
5. **Dev tracks main** — if main receives a hotfix, dev must merge it back

## CI/CD Pipeline

- **Trigger**: Push to `main` or `dev`
- **Frontend image**: `ghcr.io/chalidnl/todoless-ngx-frontend:{branch}` 
  - `main` → `:latest`
  - `dev` → `:dev`
- **PocketBase image**: `ghcr.io/chalidnl/todoless-ngx-pocketbase:{branch}`
  - Also tagged with commit SHA for traceability
- **Build args**: `VITE_GIT_COMMIT` and `VITE_APP_VERSION` baked into frontend JS
- **Quality gate**: Runs lint + typecheck on every PR and push

## Deployment Policy

### Dev (192.168.2.150:7070)
- Receives every push to `dev` branch
- Uses `docker-compose.dev.yml` with `:dev` image tags
- May contain experimental features and in-progress work
- **No approval needed** to deploy
- Deploy with: `./scripts/deploy.sh dev`

### Main (192.168.2.100:7070)
- Receives only validated code from `dev` branch
- Uses `docker-compose.yml` with `:latest` image tags  
- **Must pass validation checklist** before merge
- Deploy with: `./scripts/deploy.sh main`

### Push-to-Deploy Flow

1. Developer works on `feature/*` branch
2. Merges to `dev` → CI builds `:dev` image
3. Dev environment auto-updates (CasaOS pull-on-restart or manual `deploy.sh dev`)
4. Feature tested and validated on dev
5. Dev merged to `main` via PR → CI builds `:latest` image
6. Main environment updated via `deploy.sh main`

### Hotfix Flow

1. Create `hotfix/description` from `main`
2. Fix, test locally, push
3. Merge to `main` → deploys to production
4. **Immediately** merge `main` back to `dev`

## Deployment Verification

After every deploy, run:

```bash
./scripts/deploy.sh <env>
```

Or manually verify:

```bash
# 1. Health
curl http://<host>:7070/api/health

# 2. Version
curl http://<host>:7070/api/version

# 3. Hooks loaded
curl http://<host>:7070/api/hook-health

# 4. Frontend reachable
curl -o /dev/null -w '%{http_code}' http://<host>:7070/

# 5. Collection rules open (after hooks changes)
curl -X POST http://<host>:7070/api/open-rules
```

## Environment Comparison

Check version consistency between dev and main:

```bash
# Compare frontend hashes
curl -s http://192.168.2.100:7070/ | md5sum
curl -s http://192.168.2.150:7070/ | md5sum

# Compare API versions
curl -s http://192.168.2.100:7070/api/version
curl -s http://192.168.2.150:7070/api/version
```

## Key Files

| File | Purpose |
|---|---|
| `docker-compose.yml` | Main (production) deployment |
| `docker-compose.dev.yml` | Dev deployment with `:dev` tags |
| `scripts/deploy.sh` | Automated deploy script |
| `.github/workflows/docker-publish.yml` | CI: builds + pushes images |
| `.github/workflows/quality-gate.yml` | CI: lint + typecheck |
| `DEPLOYMENT.md` | This file |
