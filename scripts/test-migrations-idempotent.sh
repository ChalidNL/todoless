#!/usr/bin/env bash
# =============================================================================
# Migration idempotency regression test (GH#34)
#
# PocketBase records applied migrations by FILE NAME in the `_migrations`
# table (SQLite). A renamed migration file therefore re-runs on an existing
# install, so every pb_migrations/*.js up() must be a no-op when re-run.
# This script proves that guarantee:
#
#   1. boots a FRESH PocketBase with the repo hooks + migrations and asserts
#      `_migrations` tracks exactly the *.js files in pb_migrations/;
#   2. snapshots the `_collections` schema (per collection: name + field
#      names parsed from the JSON column -- `schema` when present, otherwise
#      found by introspecting pragma table_info);
#   3. kills PB and simulates the GH#34 danger: deletes every `_migrations`
#      row (a renamed file looks exactly like this to PB -- brand new);
#   4. reboots on the SAME data dir -- if any up() is not a no-op, boot fails
#      or the schema drifts, and the test fails with the serve.log tail;
#   5. asserts the row count is restored and the schema fingerprint is
#      byte-identical to the first boot.
#
# Usage:
#   bash scripts/test-migrations-idempotent.sh                  # download PB
#   PB_BIN=/path/to/pocketbase bash scripts/test-migrations-idempotent.sh
#   PB_PORT=8091 bash scripts/test-migrations-idempotent.sh
#   PB_MIGRATIONS_DIR=... PB_HOOKS_DIR=...                      # fixtures only
#
# The pinned PB_VERSION must match Dockerfile.pocketbase (muchobien 0.40.4).
# =============================================================================
set -euo pipefail

PB_VERSION="${PB_VERSION:-0.40.4}"
PB_PORT="${PB_PORT:-8091}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="${PB_MIGRATIONS_DIR:-$ROOT/pb_migrations}"
HOOKS_DIR="${PB_HOOKS_DIR:-$ROOT/pb_hooks}"

BIN_DIR="$(mktemp -d /tmp/pb-idem-bin.XXXXXX)"
DATA_DIR="$(mktemp -d /tmp/pb-idem-data.XXXXXX)"
PB_PID=""

cleanup() {
  if [[ -n "$PB_PID" ]] && kill -0 "$PB_PID" 2>/dev/null; then
    kill "$PB_PID" 2>/dev/null || true
    wait "$PB_PID" 2>/dev/null || true
  fi
  rm -rf "$BIN_DIR" "$DATA_DIR"
}
trap cleanup EXIT

# --- 1. Obtain the PocketBase binary ----------------------------------------
if [[ -n "${PB_BIN:-}" ]]; then
  PB="$PB_BIN"
else
  PB="$BIN_DIR/pocketbase"
  if [[ ! -x "$PB" ]]; then
    URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip"
    echo "[migration-idempotency] downloading PocketBase ${PB_VERSION} ..."
    curl -fsSL "$URL" -o "$BIN_DIR/pb.zip"
    python3 -m zipfile -e "$BIN_DIR/pb.zip" "$BIN_DIR" >/dev/null
    chmod +x "$PB"
  fi
fi
echo "[migration-idempotency] using PB: $("$PB" --version)"

JS_COUNT="$(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.js' | wc -l | tr -d ' ')"
echo "[migration-idempotency] migration files (*.js) in $MIGRATIONS_DIR: $JS_COUNT"

# --- 2. Boot a FRESH PocketBase with the repo hooks + migrations -------------
"$PB" serve \
  --http="127.0.0.1:${PB_PORT}" \
  --dir="$DATA_DIR/pb_data" \
  --migrationsDir="$MIGRATIONS_DIR" \
  --hooksDir="$HOOKS_DIR" \
  --automigrate >"$DATA_DIR/serve.log" 2>&1 &
PB_PID=$!

ready=0
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PB_PORT}/api/hook-health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" != "1" ]]; then
  echo "[migration-idempotency] ERROR: fresh PocketBase did not become healthy in 60s" >&2
  echo "----- serve.log -----" >&2
  cat "$DATA_DIR/serve.log" >&2 || true
  exit 1
fi
echo "[migration-idempotency] fresh boot healthy."

# --- 3. Assert _migrations row count + snapshot the schema fingerprint ------
# assert_and_fingerprint DB EXPECTED_COUNT OUT_FILE LABEL
assert_and_fingerprint() {
  python3 - "$1" "$2" "$3" "$4" <<'PY'
import json, sqlite3, sys
db, expected, out, label = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
con = sqlite3.connect(db)
try:
    got = con.execute("SELECT COUNT(*) FROM _migrations WHERE file LIKE '%.js'").fetchone()[0]
    print(f"[migration-idempotency] {label}: _migrations *.js rows = {got} (expected {expected})")
    if got != expected:
        print(f"[migration-idempotency] ERROR: expected {expected} applied migration rows, found {got} ({label})", file=sys.stderr)
        sys.exit(1)

    cols = [r[1] for r in con.execute("PRAGMA table_info(_collections)")]
    if "schema" in cols:
        json_col = "schema"
    else:
        # fallback: introspect -- pick the first column (other than the known
        # metadata ones) that can be read back.
        json_col = None
        for c in cols:
            if c in ("id", "name", "type", "system", "created", "updated", "indexes"):
                continue
            try:
                con.execute(f'SELECT "{c}" FROM _collections LIMIT 1').fetchone()
                json_col = c
                break
            except sqlite3.DatabaseError:
                continue
    if json_col is None:
        print("[migration-idempotency] ERROR: no JSON column found in _collections", file=sys.stderr)
        sys.exit(1)

    lines = []
    for name, payload in con.execute(f'SELECT name, "{json_col}" FROM _collections'):
        try:
            val = json.loads(payload or "null")
        except json.JSONDecodeError:
            print(f"[migration-idempotency] ERROR: _collections.{json_col} for '{name}' is not valid JSON", file=sys.stderr)
            sys.exit(1)
        fields = val.get("fields", []) if isinstance(val, dict) else (val or [])
        names = sorted(f.get("name", "") for f in fields if isinstance(f, dict))
        lines.append(f"{name}\t{','.join(names)}")
    lines.sort()
    with open(out, "w") as fh:
        fh.write("\n".join(lines) + "\n")
    print(f"[migration-idempotency] {label}: schema fingerprint for {len(lines)} collections -> {out}")
finally:
    con.close()
PY
}

assert_and_fingerprint "$DATA_DIR/pb_data/data.db" "$JS_COUNT" "$DATA_DIR/fingerprint.before" "fresh boot"

# --- 4. Kill PB, delete _migrations rows (the GH#34 rename danger) -----------
kill "$PB_PID" 2>/dev/null || true
wait "$PB_PID" 2>/dev/null || true
PB_PID=""
echo "[migration-idempotency] PocketBase stopped; deleting _migrations *.js rows (GH#34 simulation) ..."

python3 - "$DATA_DIR/pb_data/data.db" <<'PY'
import sqlite3, sys
con = sqlite3.connect(sys.argv[1])
try:
    cur = con.execute("DELETE FROM _migrations WHERE file LIKE '%.js'")
    con.commit()
    print(f"[migration-idempotency] deleted {cur.rowcount} migration rows")
finally:
    con.close()
PY

# --- 5. Reboot on the SAME data dir; idempotent up()s must be no-ops ---------
"$PB" serve \
  --http="127.0.0.1:${PB_PORT}" \
  --dir="$DATA_DIR/pb_data" \
  --migrationsDir="$MIGRATIONS_DIR" \
  --hooksDir="$HOOKS_DIR" \
  --automigrate >>"$DATA_DIR/serve.log" 2>&1 &
PB_PID=$!

ready=0
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PB_PORT}/api/hook-health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" != "1" ]]; then
  echo "[migration-idempotency] ERROR: reboot after _migrations wipe did not become healthy in 60s." >&2
  echo "[migration-idempotency] The migration bodies are NOT idempotent (GH#34)." >&2
  echo "----- serve.log (tail) -----" >&2
  tail -n 80 "$DATA_DIR/serve.log" >&2 || true
  exit 1
fi
echo "[migration-idempotency] reboot healthy - all up()s were no-ops on re-run."

# --- 6. Assert row count restored + fingerprint unchanged --------------------
assert_and_fingerprint "$DATA_DIR/pb_data/data.db" "$JS_COUNT" "$DATA_DIR/fingerprint.after" "after reboot"

if ! diff -u "$DATA_DIR/fingerprint.before" "$DATA_DIR/fingerprint.after"; then
  echo "[migration-idempotency] ERROR: _collections schema changed across the re-run (a migration body is not idempotent)" >&2
  exit 1
fi
echo "[migration-idempotency] schema fingerprint identical across the re-run."

kill "$PB_PID" 2>/dev/null || true
wait "$PB_PID" 2>/dev/null || true
PB_PID=""

echo "PASS: migrations are idempotent - re-running them after a _migrations wipe is a no-op (GH#34)."