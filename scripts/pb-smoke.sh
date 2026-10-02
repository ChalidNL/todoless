#!/usr/bin/env bash
# =============================================================================
# PocketBase integration smoke (GH#98)
#
# Boots a FRESH PocketBase with the repo's pb_hooks + pb_migrations on a temp
# dir, waits for /api/hook-health, then runs tests/smoke/pb-smoke.test.mjs against
# it (node --test + global fetch). Teardown happens on EXIT.
#
# Usage:
#   bash scripts/pb-smoke.sh                 # download PB 0.40.4 and run
#   PB_BIN=/path/to/pocketbase bash scripts/pb-smoke.sh   # reuse local binary
#   PB_PORT=8091 bash scripts/pb-smoke.sh    # non-default port
#
# The pinned PB_VERSION must match Dockerfile.pocketbase (muchobien 0.40.4).
# =============================================================================
set -euo pipefail

PB_VERSION="${PB_VERSION:-0.40.4}"
# Export so the booted binary (and the test env) inherit it: /api/version
# reports PB_VERSION via the build-time env (GH#33), and pb-migration-upgrade.sh
# uses the same field as its port-collision ownership guard.
export PB_VERSION
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
# Throwaway superuser for this disposable database only: the access-matrix
# tests use it for superuser-only checks. Hex password: never starts with '-' (#250).
export SMOKE_SU_EMAIL="smoke-root@example.com"
SMOKE_SU_PASSWORD="$(python3 -c 'import secrets; print(secrets.token_hex(16))')"
export SMOKE_SU_PASSWORD
# The access-matrix test seeds an unrelated family straight into this
# disposable database (no public route can create one once setup is done).
export SMOKE_DB="$DATA_DIR/pb_data/data.db"
"$PB" superuser upsert "$SMOKE_SU_EMAIL" "$SMOKE_SU_PASSWORD" --dir="$DATA_DIR/pb_data" \
  --migrationsDir="$ROOT/pb_migrations" --hooksDir="$ROOT/pb_hooks" >/dev/null

echo "[pb-smoke] booting PocketBase on 127.0.0.1:${PB_PORT} ..."
"$PB" serve \
  --http="127.0.0.1:${PB_PORT}" \
  --dir="$DATA_DIR/pb_data" \
  --migrationsDir="$ROOT/pb_migrations" \
  --hooksDir="$ROOT/pb_hooks" \
  --automigrate=false >"$DATA_DIR/serve.log" 2>&1 &
PB_PID=$!

# --- 3. Wait for readiness ---------------------------------------------------
ready=0
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PB_PORT}/api/hook-health" >/dev/null 2>&1; then
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
  PB_URL="http://127.0.0.1:${PB_PORT}" PB_VERSION="$PB_VERSION" node --test tests/smoke/*.test.mjs
)

# --- 5. GH#56: request/error logs must reach stdout + _logs ---------------
# The request-logger middleware (pb_hooks/04_request_logger.pb.js) must have
# written [pb-request] lines for both 2xx and 4xx traffic to the container
# stdout/stderr (captured in serve.log) and mirrored the 4xx to _logs.
echo "[pb-smoke] verifying request logs reach stdout (GH#56) ..."
if ! grep -q "\[pb-request\]" "$DATA_DIR/serve.log"; then
  echo "[pb-smoke] ERROR: no [pb-request] lines found in pocketbase stdout" >&2
  exit 1
fi
if ! grep -q "\[pb-request\].*method=GET.*path=/api/hook-health.*status=200" "$DATA_DIR/serve.log"; then
  echo "[pb-smoke] ERROR: missing 2xx [pb-request] line (hook-health 200)" >&2
  exit 1
fi
if ! grep -Eq "\[pb-request\].*status=(400|401|403|404|429|5[0-9][0-9])" "$DATA_DIR/serve.log"; then
  echo "[pb-smoke] ERROR: missing 4xx/5xx [pb-request] line" >&2
  exit 1
fi
if ! grep -q "\[pb-request\].*path=/api/validate-invite.*ip=203.0.113.9" "$DATA_DIR/serve.log"; then
  echo "[pb-smoke] ERROR: request logger did not resolve the client IP from X-Forwarded-For (GH#43)" >&2
  grep "path=/api/validate-invite" "$DATA_DIR/serve.log" | tail -3 >&2
  exit 1
fi
echo "[pb-smoke] stdout request logging OK"

# --- 5b. GH#9: handler exceptions must be logged by lib/errors.js ----------
# Route callbacks run in PocketBase executor VMs that do not see globals set
# by hook files. A helper that is only bound on the loader VM's globalThis
# (as respondError once was) surfaces as "ReferenceError: X is not defined" in
# serve.log and the real error is lost. The smoke suite triggers one handler
# exception on purpose (malformed JSON to /api/invites/create); its
# [respondError] line must be present and no "is not defined" may occur.
echo "[pb-smoke] verifying handler exceptions reach the log via respondError (GH#9) ..."
if grep -q "is not defined" "$DATA_DIR/serve.log"; then
  echo "[pb-smoke] ERROR: a hook handler referenced an undefined identifier (loader-VM global used in an executor VM?):" >&2
  grep "is not defined" "$DATA_DIR/serve.log" | head -5 >&2
  exit 1
fi
if ! grep -q "\[respondError\] POST /api/invites/create" "$DATA_DIR/serve.log"; then
  echo "[pb-smoke] ERROR: expected a [respondError] line for the provoked handler exception" >&2
  exit 1
fi
echo "[pb-smoke] respondError logging OK"
echo "[pb-smoke] verifying 4xx is mirrored into _logs (GH#56) ..."
# PB persists $app.logger() rows asynchronously; retry a few seconds before failing.
python3 - "$DATA_DIR/pb_data/auxiliary.db" <<'PY'
import sqlite3, sys, time
con = sqlite3.connect(sys.argv[1])
try:
    n = 0
    for _ in range(10):
        n = con.execute(
            "SELECT COUNT(*) FROM _logs WHERE message IN ('client error request','failed request')"
        ).fetchone()[0]
        if n > 0:
            break
        time.sleep(1)
    print(f"[pb-smoke] _logs mirror rows: {n}")
    if n == 0:
        print("[pb-smoke] ERROR: no warn/error request rows in _logs", file=sys.stderr)
        sys.exit(1)
except Exception as e:
    print(f"[pb-smoke] ERROR inspecting _logs: {e}", file=sys.stderr)
    sys.exit(1)
finally:
    con.close()
PY
echo "[pb-smoke] _logs mirror OK"