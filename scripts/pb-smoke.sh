#!/usr/bin/env bash
# =============================================================================
# PocketBase integration smoke (GH#98)
#
# Boots a FRESH PocketBase with the repo's pb_hooks + pb_migrations on a temp
# dir, waits for /api/health, then runs tests/smoke/pb-smoke.test.mjs against
# it (node --test + global fetch). Teardown happens on EXIT.
#
# Usage:
#   bash scripts/pb-smoke.sh                 # download PB 0.35.1 and run
#   PB_BIN=/path/to/pocketbase bash scripts/pb-smoke.sh   # reuse local binary
#   PB_PORT=8091 bash scripts/pb-smoke.sh    # non-default port
#
# The pinned PB_VERSION must match Dockerfile.pocketbase (muchobien 0.35.1).
# =============================================================================
set -euo pipefail

PB_VERSION="${PB_VERSION:-0.35.1}"
PB_PORT="${PB_PORT:-8090}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BIN_DIR="$(mktemp -d /tmp/pb-smoke-bin.XXXXXX)"
DATA_DIR="$(mktemp -d /tmp/pb-smoke-data.XXXXXX)"
PB_PID=""

cleanup() {
  if [[ -n "$PB_PID" ]] && kill -0 "$PB_PID" 2>/dev/null; then
    kill "$PB_PID" 2>/dev/null || true
    wait "$PB_PID" 2>/dev/null || true
  fi
  rm -rf "$BIN_DIR" "$DATA_DIR"
}
trap cleanup EXIT

# --- 1. Obtain the PocketBase binary -------------------------------------
if [[ -n "${PB_BIN:-}" ]]; then
  PB="$PB_BIN"
else
  PB="$BIN_DIR/pocketbase"
  if [[ ! -x "$PB" ]]; then
    URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip"
    echo "[pb-smoke] downloading PocketBase ${PB_VERSION} ..."
    curl -fsSL "$URL" -o "$BIN_DIR/pb.zip"
    python3 -m zipfile -e "$BIN_DIR/pb.zip" "$BIN_DIR" >/dev/null
    chmod +x "$PB"
  fi
fi

echo "[pb-smoke] using PB: $("$PB" --version)"

# --- 2. Start PocketBase with repo hooks + migrations on a temp dir --------
echo "[pb-smoke] booting PocketBase on 127.0.0.1:${PB_PORT} ..."
"$PB" serve \
  --http="127.0.0.1:${PB_PORT}" \
  --dir="$DATA_DIR/pb_data" \
  --migrationsDir="$ROOT/pb_migrations" \
  --hooksDir="$ROOT/pb_hooks" \
  --automigrate >"$DATA_DIR/serve.log" 2>&1 &
PB_PID=$!

# --- 3. Wait for readiness ---------------------------------------------------
ready=0
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PB_PORT}/api/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" != "1" ]]; then
  echo "[pb-smoke] ERROR: PocketBase did not become healthy in 60s" >&2
  echo "----- serve.log -----" >&2
  cat "$DATA_DIR/serve.log" >&2 || true
  exit 1
fi
echo "[pb-smoke] PocketBase healthy. Running tests/smoke ..."

# --- 4. Run the smoke suite --------------------------------------------------
(
  cd "$ROOT"
  PB_URL="http://127.0.0.1:${PB_PORT}" node --test tests/smoke/*.test.mjs
)