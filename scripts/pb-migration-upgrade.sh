#!/usr/bin/env bash
# =============================================================================
# PocketBase migration-upgrade test (GH#39)
#
# Every migration is otherwise only exercised on an EMPTY database (fresh
# install). This script proves migrations are safe for EXISTING installations —
# the class of bug behind GH#34 (renamed files re-run), GH#36 (rollbacks
# re-opening public registration) and GH#37 (backfill regressions):
#
#   1. Snapshot: boots PocketBase with the PREVIOUS release's pb_migrations +
#      pb_hooks (git ref; default origin/main, or HEAD~1 on a main push), then
#      seeds a small dataset over its public API. This is the "previous release
#      snapshot" (synthetic + anonymised — no real user data).
#   2. Upgrade: reproduces the shipped image's startup on the snapshot:
#        - the runtime migrations dir is the previous install's volume files
#          plus the CURRENT bundled files seeded in (seed_dir semantics), then
#        - the entrypoint's MIGRATION_RENAMES sync (parsed straight from
#          pocketbase-entrypoint.sh) removes stale old-named files and renames
#          `_migrations` tracking rows so declared renames never re-run, then
#        - PocketBase boots with the CURRENT pb_hooks and applies only the
#          genuinely new migration files — exactly what a self-hosted upgrade
#          does inside the container.
#   3. Control: also boots the CURRENT migrations on a FRESH dir once.
#   4. Assert (python/sqlite): every current migration file must be present in
#      the upgraded `_migrations` exactly once, and every collection rule +
#      settings.backups must be IDENTICAL to the fresh control boot — this
#      catches undeclared renames, non-idempotent bodies and inverted rules.
#      The seeded rows must still exist.
#   5. Assert (HTTP, node): tests/upgrade/migration-upgrade.test.mjs — the
#      surviving data is actually reachable through the API after the upgrade.
#
# A rename NOT listed in the entrypoint's MIGRATION_RENAMES map leaves a stale
# file in the volume (or a row that does not match) and the upgrade fails —
# which is exactly the GH#34 regression this test exists to catch.
#
# The snapshot is generated in-job from git history, so it is always the true
# previous release and never goes stale. A pre-made snapshot (e.g. a release
# CI artifact or an anonymised prod backup) can be supplied instead; it should
# be a pb_data directory (with a data.db), optionally with a pb_migrations/
# subdirectory representing the previous install's migration volume.
#
# Usage:
#   bash scripts/pb-migration-upgrade.sh
#   PB_BIN=/path/to/pocketbase bash scripts/pb-migration-upgrade.sh
#   PB_PORT=8093 bash scripts/pb-migration-upgrade.sh   # uses PB_PORT, +1, +2
#   BASE_REF=<sha|branch> bash scripts/pb-migration-upgrade.sh
#   SNAPSHOT_DIR=... bash scripts/pb-migration-upgrade.sh
#
# Env: PB_VERSION (default 0.35.1 — must match Dockerfile.pocketbase),
#      PB_BIN, PB_PORT, BASE_REF, SNAPSHOT_DIR, KEEP_WORK_DIR
# =============================================================================
set -euo pipefail

PB_VERSION="${PB_VERSION:-0.35.1}"
# Random high port by default: parallel CI/dev jobs (pb-smoke, other kanban
# workers) commonly use 8090/8093-8095 — a collision would make the health
# check answer from the WRONG PocketBase process and silently corrupt the test.
PB_PORT="${PB_PORT:-$((8200 + RANDOM % 700))}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

WORK="$(mktemp -d /tmp/pb-mig-upgrade.XXXXXX)"
FRESH_DIR="$WORK/fresh"            # control: current migrations on fresh dir
DATA_DIR="$WORK/upgrade-data"      # snapshot -> upgraded instance
PREV_MIG="$WORK/prev_migrations"   # previous release's migration files
PREV_HOOKS="$WORK/prev_hooks"
UPGRADE_MIG="$WORK/upgrade_migrations"  # volume simulation: prev ∪ current
PID_FILE="$WORK/pb.pid"

cleanup() {
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    kill "$(cat "$PID_FILE")" 2>/dev/null || true
  fi
  if [[ -n "${KEEP_WORK_DIR:-}" ]]; then
    echo "[mig-upgrade] keeping work dir: $WORK"
  else
    rm -rf "$WORK"
  fi
}
trap cleanup EXIT

# --- 1. PocketBase binary ---------------------------------------------------
if [[ -n "${PB_BIN:-}" ]]; then
  PB="$PB_BIN"
else
  BIN_DIR="$(mktemp -d /tmp/pb-mig-bin.XXXXXX)"
  PB="$BIN_DIR/pocketbase"
  URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip"
  echo "[mig-upgrade] downloading PocketBase ${PB_VERSION} ..."
  curl -fsSL "$URL" -o "$BIN_DIR/pb.zip"
  python3 -m zipfile -e "$BIN_DIR/pb.zip" "$BIN_DIR" >/dev/null
  chmod +x "$PB"
fi
echo "[mig-upgrade] using PB: $("$PB" --version)"

# --- 2. Resolve the previous release ref ------------------------------------
resolve_base() {
  if [[ -n "${BASE_REF:-}" ]]; then
    echo "$BASE_REF"
    return
  fi
  if git rev-parse -q --verify origin/main >/dev/null 2>&1 \
     && [[ "$(git rev-parse origin/main)" != "$(git rev-parse HEAD)" ]]; then
    echo "origin/main"
  elif git rev-parse -q --verify HEAD~1 >/dev/null 2>&1; then
    echo "HEAD~1"
  else
    echo "ERROR"
  fi
}
BASE="$(resolve_base)"
if [[ "$BASE" == "ERROR" ]]; then
  echo "[mig-upgrade] ERROR: cannot determine previous-release ref (no origin/main and no HEAD~1)" >&2
  exit 1
fi
echo "[mig-upgrade] previous release ref: $BASE ($(git rev-parse --short "$BASE"))"

# --- 3. Helpers --------------------------------------------------------------
pb_start() { # data_dir migrations_dir hooks_dir port log_file label
  local data="$1" mig="$2" hooks="$3" port="$4" log="$5" label="$6"
  # Pre-boot guard: if ANYTHING already answers on this port, abort loudly —
  # booting would otherwise health-check a foreign PocketBase and write seed
  # data into another worker's instance.
  if curl -fsS --connect-timeout 1 "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1; then
    echo "[mig-upgrade] ERROR: port ${port} is already serving an HTTP API — refusing to boot $label (port collision with a parallel job)" >&2
    return 1
  fi
  echo "[mig-upgrade] booting $label (port $port, dir $(basename "$data"))"
  "$PB" serve \
    --http="127.0.0.1:${port}" \
    --dir="$data" \
    --migrationsDir="$mig" \
    --hooksDir="$hooks" \
    --automigrate >"$log" 2>&1 &
  local pid=$!
  echo "$pid" >"$PID_FILE"
  local ready=0
  for _ in $(seq 1 60); do
    if kill -0 "$pid" 2>/dev/null; then
      if curl -fsS "http://127.0.0.1:${port}/api/hook-health" >/dev/null 2>&1; then
        ready=1
        break
      fi
    else
      break
    fi
    sleep 1
  done
  if [[ "$ready" != "1" ]]; then
    echo "[mig-upgrade] ERROR: $label did not become healthy on port ${port}" >&2
    echo "----- $label log ($log) -----" >&2
    cat "$log" >&2 || true
    return 1
  fi
  # Ownership guard: the API must report the PocketBase version WE launched.
  # If another worker's PocketBase squats on this port, /api/hook-health can
  # still answer 200 from a foreign process with different hooks.
  local served
  served="$(curl -fsS "http://127.0.0.1:${port}/api/version" 2>/dev/null \
             | python3 -c 'import json,sys; print(json.load(sys.stdin).get("pb",""))' 2>/dev/null || true)"
  if [[ "$served" != "$PB_VERSION" ]]; then
    echo "[mig-upgrade] ERROR: port ${port} answered /api/version with '${served:-unknown}' but we run ${PB_VERSION}; refusing to continue (port collision)" >&2
    cat "$log" >&2 || true
    return 1
  fi
  echo "[mig-upgrade] $label healthy (port $port, PB $served)"
}

pb_stop() {
  [[ -f "$PID_FILE" ]] || return 0
  local pid
  pid="$(cat "$PID_FILE")"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    for _ in $(seq 1 30); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 1
    done
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi
  wait "$pid" 2>/dev/null || true
  rm -f "$PID_FILE"
}

seed() { # base_url
  local base="$1"
  echo "[mig-upgrade] seeding dataset via the previous release API ..."
  curl -fsS -X POST "$base/api/register" \
    -H 'Content-Type: application/json' \
    -d '{"email":"migration.upgrade@test.local","password":"migration-upgrade-123","passwordConfirm":"migration-upgrade-123","name":"Migration Admin","family_name":"Migration Family","user_type":"family_member","language":"en"}' \
    -o "$WORK/seed_register.json"
  python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); assert "user" in d, d; print(d["user"]["id"])' \
    "$WORK/seed_register.json" >"$WORK/seed_uid.txt"
  local uid
  uid="$(cat "$WORK/seed_uid.txt")"
  curl -fsS -X POST "$base/api/collections/users/auth-with-password" \
    -H 'Content-Type: application/json' \
    -d '{"identity":"migration.upgrade@test.local","password":"migration-upgrade-123"}' \
    -o "$WORK/seed_auth.json"
  local token
  token="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("token",""))' "$WORK/seed_auth.json")"
  if [[ -z "$token" || "$token" == "None" ]]; then
    echo "[mig-upgrade] ERROR: seed auth failed" >&2
    cat "$WORK/seed_auth.json" >&2 || true
    return 1
  fi
  curl -fsS -X POST "$base/api/collections/tasks/records" \
    -H "Authorization: Bearer ${token}" -H 'Content-Type: application/json' \
    -d "{\"title\":\"Pre-existing upgrade task\",\"status\":\"todo\",\"is_private\":false,\"user\":\"$uid\"}" \
    -o "$WORK/seed_task.json"
  curl -fsS -X POST "$base/api/collections/items/records" \
    -H "Authorization: Bearer ${token}" -H 'Content-Type: application/json' \
    -d "{\"title\":\"Melk\",\"checked\":false,\"user\":\"$uid\"}" \
    -o "$WORK/seed_item.json"
  curl -fsS -X POST "$base/api/collections/notes/records" \
    -H "Authorization: Bearer ${token}" -H 'Content-Type: application/json' \
    -d "{\"title\":\"Pre-existing upgrade note\",\"content\":\"survives upgrade\",\"user\":\"$uid\"}" \
    -o "$WORK/seed_note.json"
  python3 - "$WORK/seed_task.json" "$WORK/seed_item.json" "$WORK/seed_note.json" <<'PY'
import json, sys
for f in sys.argv[1:]:
    d = json.load(open(f))
    if 'id' not in d:
        raise SystemExit(f"[mig-upgrade] seed record failed: {f}: {d}")
print("[mig-upgrade] seeded 1 user, 1 task, 1 grocery item, 1 note")
PY
}

# Apply the entrypoint's MIGRATION_RENAMES (read from pocketbase-entrypoint.sh)
# to a migrations dir copy + the snapshot db — the exact pre-start sync the
# shipped image performs (GH#38).
apply_rename_sync() { # migrations_dir data_db
  python3 - "$1" "$2" "$ROOT/pocketbase-entrypoint.sh" <<'PY'
import os, re, sqlite3, sys
mig_dir, db, entrypoint = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(entrypoint, encoding="utf-8").read()
m = re.search(r"MIGRATION_RENAMES='(.*?)'", text, re.S)
pairs = []
if m:
    for line in m.group(1).splitlines():
        line = line.strip()
        if not line or "|" not in line:
            continue
        old, new = (x.strip() for x in line.split("|", 1))
        if old and new and old != new:
            pairs.append((old, new))
removed = 0
for old, _new in pairs:
    p = os.path.join(mig_dir, old)
    if os.path.isfile(p):
        os.remove(p)
        removed += 1
renamed = 0
if os.path.exists(db):
    con = sqlite3.connect(db)
    cur = con.cursor()
    for old, new in pairs:
        cur.execute(
            "UPDATE _migrations SET file=? WHERE file=? AND NOT EXISTS "
            "(SELECT 1 FROM _migrations WHERE file=?)",
            (new, old, new),
        )
        renamed += cur.rowcount
    con.commit()
    con.close()
print(f"[mig-upgrade] entrypoint rename sync: {len(pairs)} map pair(s), "
      f"removed {removed} stale file(s), renamed {renamed} row(s)")
if not m:
    print("[mig-upgrade] note: no MIGRATION_RENAMES map in pocketbase-entrypoint.sh "
          "(no rename sync needed on this branch)")
PY
}

dump_state() { # data.db -> json_file
  python3 - "$1" "$2" <<'PY'
import json, os, sqlite3, sys
db, out = sys.argv[1], sys.argv[2]
con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
migs = sorted(r[0] for r in con.execute(
    "SELECT file FROM _migrations WHERE file LIKE '%.js'"))
rules = {
    name: {
        "createRule": cr, "listRule": lr, "updateRule": ur,
        "deleteRule": dr, "viewRule": vr,
    }
    for name, cr, lr, ur, dr, vr in con.execute(
        "SELECT name, createRule, listRule, updateRule, deleteRule, viewRule "
        "FROM _collections ORDER BY name")
}
backups = {"cron": None, "cronMaxKeep": None}
row = con.execute("SELECT value FROM _params WHERE id='settings'").fetchone()
if row:
    try:
        s = json.loads(row[0])
        backups = {
            "cron": (s.get("backups") or {}).get("cron"),
            "cronMaxKeep": (s.get("backups") or {}).get("cronMaxKeep"),
        }
    except Exception:
        pass
counts = {}
for t in ("users", "families", "tasks", "items", "notes"):
    try:
        counts[t] = con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    except Exception:
        counts[t] = None
con.close()
with open(out, "w") as fh:
    json.dump({"migrations": migs, "rules": rules, "backups": backups, "counts": counts}, fh, sort_keys=True)
print(f"[mig-upgrade] state dumped: {os.path.basename(db)} "
      f"({len(migs)} js migrations, {len(rules)} collections)")
PY
}

# --- 4. Previous-release snapshot (migrations + hooks + seeded data) ---------
if [[ -n "${SNAPSHOT_DIR:-}" ]]; then
  echo "[mig-upgrade] using provided snapshot dir: $SNAPSHOT_DIR"
  # Normalise: whatever layout the snapshot has, data.db must end up at
  # $DATA_DIR/data.db (PocketBase --dir IS the pb_data directory).
  if [[ -f "$SNAPSHOT_DIR/data.db" ]]; then
    mkdir -p "$DATA_DIR"
    cp -a "$SNAPSHOT_DIR/." "$DATA_DIR/"
  elif [[ -d "$SNAPSHOT_DIR/pb_data" && -f "$SNAPSHOT_DIR/pb_data/data.db" ]]; then
    mkdir -p "$DATA_DIR"
    cp -a "$SNAPSHOT_DIR/pb_data/." "$DATA_DIR/"
  else
    echo "[mig-upgrade] ERROR: SNAPSHOT_DIR must be a pb_data directory (containing data.db) or contain a pb_data/ with data.db" >&2
    exit 1
  fi
  if [[ -d "$SNAPSHOT_DIR/pb_migrations" ]]; then
    mkdir -p "$PREV_MIG"
    cp -a "$SNAPSHOT_DIR/pb_migrations/." "$PREV_MIG/"
  elif [[ -d "$SNAPSHOT_DIR/pb_data/pb_migrations" ]]; then
    mkdir -p "$PREV_MIG"
    cp -a "$SNAPSHOT_DIR/pb_data/pb_migrations/." "$PREV_MIG/"
  fi
else
  mkdir -p "$PREV_MIG" "$PREV_HOOKS"
  git archive "$BASE" pb_migrations | tar -x -C "$PREV_MIG" --strip-components=1
  git archive "$BASE" pb_hooks | tar -x -C "$PREV_HOOKS" --strip-components=1
  echo "[mig-upgrade] previous release migrations: $(find "$PREV_MIG" -type f | wc -l) files"
  echo "[mig-upgrade] current     release migrations: $(find "$ROOT/pb_migrations" -type f | wc -l) files"

  P1=$((PB_PORT + 1))
  mkdir -p "$DATA_DIR"
  pb_start "$DATA_DIR" "$PREV_MIG" "$PREV_HOOKS" "$P1" "$WORK/prev.log" "previous-release snapshot boot"
  seed "http://127.0.0.1:${P1}"
  pb_stop
fi

# --- 5. Build the "runtime migrations volume" for the upgrade ------------------
# Container semantics: the install's volume already has the previous release's
# files; the current image seeds/updates its bundled files into it, then the
# entrypoint removes stale old-named files (MIGRATION_RENAMES).
mkdir -p "$UPGRADE_MIG"
if [[ -d "$PREV_MIG" ]]; then
  cp -a "$PREV_MIG/." "$UPGRADE_MIG/"
fi
cp -a "$ROOT/pb_migrations/." "$UPGRADE_MIG/"
echo "[mig-upgrade] upgrade volume migrations before sync: $(find "$UPGRADE_MIG" -type f | wc -l) files"

# --- 6. Control: fresh boot of the CURRENT migrations -------------------------
P0=$((PB_PORT))
mkdir -p "$FRESH_DIR"
pb_start "$FRESH_DIR" "$ROOT/pb_migrations" "$ROOT/pb_hooks" "$P0" "$WORK/fresh.log" "fresh control boot"
pb_stop

# --- 7. Apply the entrypoint rename sync, then upgrade ------------------------
apply_rename_sync "$UPGRADE_MIG" "$DATA_DIR/data.db"
echo "[mig-upgrade] upgrade volume migrations after sync: $(find "$UPGRADE_MIG" -type f | wc -l) files"

P2=$((PB_PORT + 2))
pb_start "$DATA_DIR" "$UPGRADE_MIG" "$ROOT/pb_hooks" "$P2" "$WORK/upgrade.log" "upgraded boot"

if [[ -z "${SNAPSHOT_DIR:-}" ]]; then
  # --- 7b. Assert seeded data survived (HTTP) ----------------------------------
  (
    cd "$ROOT"
    PB_URL="http://127.0.0.1:${P2}" PB_VERSION="$PB_VERSION" MIG_UPGRADE=1 node --test tests/upgrade/*.test.mjs
  )
else
  echo "[mig-upgrade] SNAPSHOT_DIR mode: skipping HTTP survival suite (not our seed)"
fi
pb_stop

# --- 8. Assert state: upgraded vs fresh control --------------------------------
dump_state "$FRESH_DIR/data.db" "$WORK/fresh.json"
dump_state "$DATA_DIR/data.db" "$WORK/upgrade.json"
# Current shipped migration file list (from the repo, exactly what a fresh
# install applies) — used to prove every file landed in _migrations once.
find "$ROOT/pb_migrations" -maxdepth 1 -name '*.js' -printf '%f\n' | sort >"$WORK/current_migrations.txt"
python3 - "$WORK/current_migrations.txt" "$WORK/fresh.json" "$WORK/upgrade.json" <<'PY'
import json, sys
cur_file, fresh_file, up_file = sys.argv[1], sys.argv[2], sys.argv[3]
current = sorted(x.strip() for x in open(cur_file) if x.strip())
fresh = json.load(open(fresh_file))
up = json.load(open(up_file))
ok = True

def report(title, detail):
    global ok
    ok = False
    print(f"FAIL: {title}")
    print(detail)

# 8a. every current migration file must be recorded exactly once
missing = [f for f in current if f not in up["migrations"]]
if missing:
    report("current migration files missing from upgraded _migrations",
           f"  {missing}")
if len(up["migrations"]) != len(set(up["migrations"])):
    report("duplicate migration file rows in upgraded _migrations",
           f"  {[f for f in set(up['migrations']) if up['migrations'].count(f) > 1]}")

# 8b. fresh control must also have applied every current file exactly once
missing_fresh = [f for f in current if f not in fresh["migrations"]]
if missing_fresh:
    report("current migration files missing from FRESH _migrations (control broken)",
           f"  {missing_fresh}")

# 8c. rules must be identical between fresh and upgraded (catches #36-style
#     flips and non-idempotent body re-runs)
if fresh["rules"] != up["rules"]:
    detail = []
    for name in sorted(set(fresh["rules"]) | set(up["rules"])):
        if fresh["rules"].get(name) != up["rules"].get(name):
            detail.append(f"  {name}:")
            detail.append(f"    fresh:    {fresh['rules'].get(name)}")
            detail.append(f"    upgraded: {up['rules'].get(name)}")
    report("collection rules differ between fresh and upgraded", "\n".join(detail))

# 8d. settings.backups must be identical (backups defaults are set by a
#     migration — it must not behave differently on an existing install)
if fresh["backups"] != up["backups"]:
    report("settings.backups differ between fresh and upgraded",
           f"  fresh: {fresh['backups']}\n  upgraded: {up['backups']}")

# 8e. seeded data must survive (non-empty counts in the upgraded instance)
for table in ("users", "tasks", "items", "notes"):
    if up["counts"].get(table) == 0:
        report(f"seeded {table} missing after upgrade", f"  counts: {up['counts']}")

print(f"[mig-upgrade] upgraded _migrations: {len(up['migrations'])} js rows "
      f"(current set = {len(current)} files)")
print(f"[mig-upgrade] seeded counts after upgrade: {up['counts']}")
if not ok:
    raise SystemExit("[mig-upgrade] FAIL: upgrade produced a state that differs from a fresh install")
print("[mig-upgrade] state parity OK: every migration applied once; rules and backups match a fresh install")
PY

echo "[mig-upgrade] PASS — migrations apply cleanly on top of the previous release snapshot"