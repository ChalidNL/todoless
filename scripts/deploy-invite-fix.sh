#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/opt/data/home/todoless-ngx"
APPDATA_DIR="/DATA/AppData/todoless-ngx"
BACKUP_ROOT="$APPDATA_DIR/backups/invite-fix"
COMPOSE_FILE="$REPO_DIR/docker-compose.yml"
FRONTEND_SERVICE="todoless-ngx"
POCKETBASE_SERVICE="pocketbase"
POCKETBASE_CONTAINER="todoless-ngx-pocketbase"
FRONTEND_CONTAINER="todoless-ngx"

PRECHECK_ONLY="false"
FRONTEND_IMAGE_OVERRIDE=""

log() { printf '[deploy-invite-fix] %s\n' "$*"; }
err() { printf '[deploy-invite-fix][ERROR] %s\n' "$*" >&2; }

usage() {
  cat <<'EOF'
Usage: deploy-invite-fix.sh [options]

Options:
  --precheck-only                 Run checks only, do not backup/deploy
  --frontend-image <image:tag>    Override frontend image in compose before deploy
  -h, --help                      Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --precheck-only) PRECHECK_ONLY="true"; shift ;;
    --frontend-image) FRONTEND_IMAGE_OVERRIDE="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) err "Unknown argument: $1"; usage; exit 1 ;;
  esac
done

require_cmd() { command -v "$1" >/dev/null 2>&1 || { err "Missing command: $1"; exit 1; }; }

wait_frontend() {
  local tries=30
  for ((i=1; i<=tries; i++)); do
    if curl -fsS http://127.0.0.1:7070/ >/dev/null; then
      log "Frontend health OK"
      return 0
    fi
    sleep 2
  done
  return 1
}

pb_health() {
  docker exec "$POCKETBASE_CONTAINER" sh -lc "wget -qO- http://127.0.0.1:8090/api/health || curl -fsSL http://127.0.0.1:8090/api/health"
}

precheck() {
  log "Running precheck"
  require_cmd docker
  require_cmd curl
  require_cmd tar

  cd "$REPO_DIR"

  docker --version >/dev/null
  docker compose version >/dev/null
  docker compose -f "$COMPOSE_FILE" config --quiet
  docker compose -f "$COMPOSE_FILE" ps >/dev/null

  docker ps --format '{{.Names}}' | grep -qx "$FRONTEND_CONTAINER" || { err "Container missing: $FRONTEND_CONTAINER"; exit 1; }
  docker ps --format '{{.Names}}' | grep -qx "$POCKETBASE_CONTAINER" || { err "Container missing: $POCKETBASE_CONTAINER"; exit 1; }

  [[ -d "$APPDATA_DIR/pb_data" ]] || { err "Missing directory: $APPDATA_DIR/pb_data"; exit 1; }
  [[ -d "$APPDATA_DIR/pb_migrations" ]] || { err "Missing directory: $APPDATA_DIR/pb_migrations"; exit 1; }

  curl -fsS http://127.0.0.1:7070/ >/dev/null || { err "Frontend health failed"; exit 1; }
  pb_health >/dev/null || { err "PocketBase health failed"; exit 1; }

  log "Precheck OK"
}

backup() {
  local ts backup_dir
  ts="$(date +%F_%H%M%S)"
  backup_dir="$BACKUP_ROOT/$ts"

  mkdir -p "$backup_dir"

  log "Creating backup in $backup_dir"
  cp -a "$APPDATA_DIR/pb_data" "$backup_dir/"
  cp -a "$APPDATA_DIR/pb_migrations" "$backup_dir/"
  cp -a "$COMPOSE_FILE" "$backup_dir/docker-compose.yml"

  tar -czf "$backup_dir/pocketbase-backup.tgz" -C "$APPDATA_DIR" pb_data pb_migrations

  {
    echo "timestamp=$ts"
    echo "repo_dir=$REPO_DIR"
    echo "compose_file=$COMPOSE_FILE"
    echo "git_sha=$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
    echo "frontend_image_before=$(docker inspect -f '{{.Config.Image}}' "$FRONTEND_CONTAINER" 2>/dev/null || echo unknown)"
    echo "pocketbase_image_before=$(docker inspect -f '{{.Config.Image}}' "$POCKETBASE_CONTAINER" 2>/dev/null || echo unknown)"
  } > "$backup_dir/release-metadata.env"

  echo "$backup_dir" > "$BACKUP_ROOT/.last_backup"
  log "Backup completed"
}

deploy() {
  cd "$REPO_DIR"

  if [[ -n "$FRONTEND_IMAGE_OVERRIDE" ]]; then
    log "Applying frontend image override: $FRONTEND_IMAGE_OVERRIDE"
    python3 - <<PY
from pathlib import Path
p = Path("$COMPOSE_FILE")
s = p.read_text()
old = "    image: ghcr.io/chalidnl/todoless-ngx-frontend:latest"
new = "    image: $FRONTEND_IMAGE_OVERRIDE"
if old in s:
    p.write_text(s.replace(old, new, 1))
else:
    raise SystemExit("Expected frontend image line not found in compose file")
PY
  fi

  log "Pulling images"
  docker compose -f "$COMPOSE_FILE" pull

  log "Rolling out PocketBase then frontend"
  docker compose -f "$COMPOSE_FILE" up -d "$POCKETBASE_SERVICE"
  docker compose -f "$COMPOSE_FILE" up -d "$FRONTEND_SERVICE"

  docker compose -f "$COMPOSE_FILE" ps
}

postcheck() {
  log "Running postcheck"

  wait_frontend || { err "Frontend did not become healthy"; exit 1; }
  pb_health >/dev/null || { err "PocketBase health failed after deploy"; exit 1; }

  log "Recent logs: $FRONTEND_CONTAINER"
  docker logs --tail 100 "$FRONTEND_CONTAINER" || true
  log "Recent logs: $POCKETBASE_CONTAINER"
  docker logs --tail 100 "$POCKETBASE_CONTAINER" || true

  log "Error scan last 10m"
  docker logs --since 10m "$FRONTEND_CONTAINER" 2>&1 | grep -Ei 'error|exception|failed' || true
  docker logs --since 10m "$POCKETBASE_CONTAINER" 2>&1 | grep -Ei 'error|exception|failed' || true

  log "Postcheck OK"
}

main() {
  precheck

  if [[ "$PRECHECK_ONLY" == "true" ]]; then
    log "Precheck-only mode complete"
    exit 0
  fi

  backup
  deploy
  postcheck

  log "Invite-fix deployment completed"
}

main "$@"
