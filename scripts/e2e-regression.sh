#!/usr/bin/env bash
# =============================================================================
# TodoLess end-to-end regression (Playwright) — the release-candidate gate.
#
# Boots a FRESH PocketBase with the repo's pb_migrations + pb_hooks, starts the
# Vite dev server against it, seeds a disposable QA family and runs
# tests/regression/specs. Teardown on EXIT.
#
# Usage:
#   bash scripts/e2e-regression.sh                       # local, self-contained
#   BASE_URL=https://dev.example npx playwright test     # against a live stack
#   PB_BIN=/path/to/pocketbase bash scripts/e2e-regression.sh
#
# Env: PB_PORT (8091 — vite.config.ts proxies /api here), APP_PORT (5173),
#      PB_VERSION (0.40.4, must match Dockerfile.pocketbase), PB_SUPERUSER_PASS
# =============================================================================
set -euo pipefail

PB_VERSION="${PB_VERSION:-0.40.4}"
PB_PORT="${PB_PORT:-8091}"
APP_PORT="${APP_PORT:-5173}"
PB_SUPERUSER="${PB_SUPERUSER:-qa-admin@todoless.local}"
PB_SUPERUSER_PASS="${PB_SUPERUSER_PASS:-QaAdmin12345!}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BIN_DIR="$(mktemp -d /tmp/todoless-e2e-bin.XXXXXX)"
DATA_DIR="$(mktemp -d /tmp/todoless-e2e-data.XXXXXX)"
PB_PID=""
APP_PID=""

cleanup() {
  for pid in "$APP_PID" "$PB_PID"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then kill "$pid" 2>/dev/null || true; fi
  done
  rm -rf "$BIN_DIR" "$DATA_DIR"
}
trap cleanup EXIT

# --- 1. PocketBase binary ---------------------------------------------------
if [[ -n "${PB_BIN:-}" ]]; then
  PB="$PB_BIN"
elif command -v pocketbase >/dev/null 2>&1; then
  PB="$(command -v pocketbase)"
else
  PB="$BIN_DIR/pocketbase"
  URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip"
  echo "[e2e] downloading PocketBase ${PB_VERSION} ..."
  curl -fsSL "$URL" -o "$BIN_DIR/pb.zip"
  python3 -m zipfile -e "$BIN_DIR/pb.zip" "$BIN_DIR" >/dev/null
  chmod +x "$PB"
fi
echo "[e2e] PB: $("$PB" --version)"

# --- 2. Boot PocketBase with repo hooks + migrations ------------------------
"$PB" serve --http="127.0.0.1:${PB_PORT}" --dir="$DATA_DIR/pb_data" \
  --migrationsDir="$ROOT/pb_migrations" --hooksDir="$ROOT/pb_hooks" --automigrate \
  >"$DATA_DIR/pb.log" 2>&1 &
PB_PID=$!
for _ in $(seq 1 40); do
  curl -fsS -m 2 "http://127.0.0.1:${PB_PORT}/api/health" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS -m 2 "http://127.0.0.1:${PB_PORT}/api/health" >/dev/null || { echo "[e2e] PocketBase failed to boot"; tail -30 "$DATA_DIR/pb.log"; exit 1; }

"$PB" superuser upsert "$PB_SUPERUSER" "$PB_SUPERUSER_PASS" --dir="$DATA_DIR/pb_data" >/dev/null

# --- 3. Seed the QA fixture data -------------------------------------------
PB_URL="http://127.0.0.1:${PB_PORT}" PB_SUPERUSER="$PB_SUPERUSER" PB_SUPERUSER_PASS="$PB_SUPERUSER_PASS" \
  node "$ROOT/tests/regression/seed.mjs"

# --- 4. Frontend against that PocketBase -----------------------------------
( cd "$ROOT" && VITE_POCKETBASE_URL="http://127.0.0.1:${PB_PORT}" npx vite --port "$APP_PORT" --strictPort --host 127.0.0.1 \
  >"$DATA_DIR/vite.log" 2>&1 ) &
APP_PID=$!
for _ in $(seq 1 60); do
  curl -fsS -m 2 "http://127.0.0.1:${APP_PORT}/" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS -m 2 "http://127.0.0.1:${APP_PORT}/" >/dev/null || { echo "[e2e] vite failed to boot"; tail -30 "$DATA_DIR/vite.log"; exit 1; }

# --- 5. Run the suite ------------------------------------------------------
cd "$ROOT/tests/regression"
# Only install a browser when no usable one is present. `--with-deps` needs root and
# fails on locked-down hosts (this is what silently kept the gate from running at all).
if [[ -z "${PW_CHROME_PATH:-}" ]] && [[ ! -x "/opt/data/.playwright/chromium-1223/chrome-linux64/chrome" ]]; then
  npx playwright install --only-shell chromium >/dev/null
fi
BASE_URL="http://127.0.0.1:${APP_PORT}" API_BASE_URL="http://127.0.0.1:${PB_PORT}" \
  PB_SUPERUSER_PASS="$PB_SUPERUSER_PASS" \
  npx playwright test "$@"
