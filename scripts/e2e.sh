#!/usr/bin/env bash
# =============================================================================
# Mobile E2E suite runner.
#
# Boots a FRESH PocketBase with the repo's pb_hooks + pb_migrations on a temp
# dir, builds the app (unless SKIP_BUILD=1), serves build/ with `vite preview`
# (/api proxied to that PocketBase) and runs Playwright (tests/e2e/*.spec.ts).
#
# Usage:
#   bash scripts/e2e.sh                        # download PB 0.40.4, build, run
#   PB_BIN=/path/to/pocketbase bash scripts/e2e.sh
#   SKIP_BUILD=1 bash scripts/e2e.sh -g layout # reuse build/, filter specs
# =============================================================================
set -euo pipefail

PB_VERSION="${PB_VERSION:-0.40.4}"
PB_PORT="${E2E_PB_PORT:-8098}"
WEB_PORT="${E2E_WEB_PORT:-4173}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$(mktemp -d /tmp/e2e-pb-bin.XXXXXX)"
DATA_DIR="$(mktemp -d /tmp/e2e-pb-data.XXXXXX)"
PIDS=()

cleanup() {
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
  rm -rf "$BIN_DIR" "$DATA_DIR"
}
trap cleanup EXIT

if [[ -n "${PB_BIN:-}" ]]; then
  PB="$PB_BIN"
else
  PB="$BIN_DIR/pocketbase"
  echo "[e2e] downloading PocketBase ${PB_VERSION} ..."
  curl -fsSL "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" -o "$BIN_DIR/pb.zip"
  python3 -m zipfile -e "$BIN_DIR/pb.zip" "$BIN_DIR" >/dev/null
  chmod +x "$PB"
fi

cd "$ROOT"
if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo "[e2e] building app ..."
  npm run build >/dev/null
fi

echo "[e2e] booting PocketBase on 127.0.0.1:${PB_PORT} ..."
PB_VERSION="$PB_VERSION" "$PB" serve --http="127.0.0.1:${PB_PORT}" --dir="$DATA_DIR/pb_data" \
  --migrationsDir="$ROOT/pb_migrations" --hooksDir="$ROOT/pb_hooks" --automigrate >"$DATA_DIR/pb.log" 2>&1 &
PIDS+=("$!")

echo "[e2e] serving build/ on 127.0.0.1:${WEB_PORT} ..."
TODOLESS_API_PROXY="http://127.0.0.1:${PB_PORT}" npx vite preview --host 127.0.0.1 --port "$WEB_PORT" --strictPort >"$DATA_DIR/web.log" 2>&1 &
PIDS+=("$!")

for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PB_PORT}/api/hook-health" >/dev/null 2>&1 \
    && curl -fsS "http://127.0.0.1:${WEB_PORT}/" >/dev/null 2>&1; then
    break
  fi
  if [[ "$i" == "60" ]]; then
    echo "[e2e] ERROR: services did not become ready" >&2
    cat "$DATA_DIR/pb.log" "$DATA_DIR/web.log" >&2 || true
    exit 1
  fi
  sleep 1
done

E2E_BASE_URL="http://127.0.0.1:${WEB_PORT}" npx playwright test "$@"
