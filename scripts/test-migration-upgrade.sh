#!/usr/bin/env bash
# =============================================================================
# Migration upgrade test against the previous release (#39)
#
# 1. Boot PocketBase with the PREVIOUS release's pb_migrations + pb_hooks
#    (default: the latest v* tag, override with PREV_REF) on a fresh data dir
#    and seed realistic data through that release's own APIs.
# 2. Stop it and boot the CURRENT pb_migrations + pb_hooks on the same data
#    dir: every pending migration must apply cleanly, and the seeded data must
#    survive with privacy intact (tests/upgrade/upgrade-check.mjs).
#
# Catches ordering/collision surprises that a fresh-install run cannot (e.g.
# a z0xx migration sorting after 073 on an existing database).
#
# Usage:
#   bash scripts/test-migration-upgrade.sh
#   PREV_REF=v0.3.0-beta PB_BIN=/path/to/pocketbase bash scripts/test-migration-upgrade.sh
# =============================================================================
set -euo pipefail

PB_VERSION="${PB_VERSION:-0.40.4}"
PB_PORT="${PB_PORT:-8099}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d /tmp/pb-upgrade.XXXXXX)"
PB_PID=""

cleanup() {
  if [[ -n "$PB_PID" ]] && kill -0 "$PB_PID" 2>/dev/null; then kill "$PB_PID" 2>/dev/null || true; wait "$PB_PID" 2>/dev/null || true; fi
  rm -rf "$WORK"
}
trap cleanup EXIT

cd "$ROOT"
PREV_REF="${PREV_REF:-$(git tag --list 'v*' --sort=-v:refname | head -1)}"
if [[ -z "$PREV_REF" ]] || ! git rev-parse --verify --quiet "$PREV_REF^{commit}" >/dev/null; then
  echo "[upgrade] notice: no previous release tag available (fetch tags) - skipping."
  exit 0
fi
echo "[upgrade] previous release: $PREV_REF ($(git rev-parse --short "$PREV_REF"))"

if [[ -n "${PB_BIN:-}" ]]; then
  PB="$PB_BIN"
else
  PB="$WORK/pocketbase"
  curl -fsSL "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" -o "$WORK/pb.zip"
  python3 -m zipfile -e "$WORK/pb.zip" "$WORK" >/dev/null
  chmod +x "$PB"
fi

mkdir -p "$WORK/old"
git archive "$PREV_REF" pb_migrations pb_hooks | tar -x -C "$WORK/old"

boot() { # $1 = dir containing pb_migrations + pb_hooks, $2 = log file
  PB_VERSION="$PB_VERSION" "$PB" serve --http="127.0.0.1:${PB_PORT}" --dir="$WORK/pb_data" \
    --migrationsDir="$1/pb_migrations" --hooksDir="$1/pb_hooks" --automigrate >"$2" 2>&1 &
  PB_PID=$!
  for _ in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:${PB_PORT}/api/hook-health" >/dev/null 2>&1; then return 0; fi
    if ! kill -0 "$PB_PID" 2>/dev/null; then break; fi
    sleep 1
  done
  echo "[upgrade] ERROR: PocketBase did not become healthy" >&2
  cat "$2" >&2
  exit 1
}
stop() { kill "$PB_PID"; wait "$PB_PID" 2>/dev/null || true; PB_PID=""; }

echo "[upgrade] booting $PREV_REF ..."
boot "$WORK/old" "$WORK/old.log"
PB_URL="http://127.0.0.1:${PB_PORT}" node tests/upgrade/upgrade-check.mjs seed "$WORK/state.json"
stop

echo "[upgrade] upgrading the same database to the working tree ..."
boot "$ROOT" "$WORK/new.log"
if grep -Eiq 'failed to apply migration|migration .*error|panic' "$WORK/new.log"; then
  echo "[upgrade] ERROR: migration failure while upgrading" >&2
  cat "$WORK/new.log" >&2
  exit 1
fi
python3 - "$WORK/pb_data/data.db" "$ROOT/pb_migrations" <<'PY'
import os, sqlite3, sys
con = sqlite3.connect(sys.argv[1])
applied = {row[0] for row in con.execute("SELECT file FROM _migrations")}
missing = sorted(f for f in os.listdir(sys.argv[2]) if f.endswith('.js') and f not in applied)
if missing:
    print("[upgrade] ERROR: migrations not applied after upgrade:", missing, file=sys.stderr)
    sys.exit(1)
print(f"[upgrade] all {len([f for f in os.listdir(sys.argv[2]) if f.endswith('.js')])} current migrations applied")
PY
PB_URL="http://127.0.0.1:${PB_PORT}" node tests/upgrade/upgrade-check.mjs verify "$WORK/state.json"
echo "PASS: $PREV_REF data upgrades cleanly to the working tree (#39)."
