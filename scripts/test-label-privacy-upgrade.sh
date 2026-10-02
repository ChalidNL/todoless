#!/usr/bin/env bash
# =============================================================================
# Label privacy upgrade regression (z061 / z062 / z073)
#
# z062_enforce_label_privacy read the legacy `labels` JSON field with
# record.get(), which in the PocketBase JSVM yields the raw JSON bytes. On an
# existing database that marked every task with a non-NULL `labels` value as
# private and never backfilled the canonical `label` relation. This script
# proves both the repair for already-upgraded databases and the fixed upgrade
# path, against the real PocketBase binary:
#
#   A. boot the migrations that sort before z062 on a fresh data dir and seed
#      a family (owner + member), one family label and five legacy tasks:
#        T1 labels NULL            T2 labels '[]'
#        T3 labels '["<label>"]'   T4 labels '["Boodschappen"]' (free text)
#        T5 labels '[]', is_private = true (owner's deliberate choice)
#   B. (damage) boot z062 exactly as shipped (SHIPPED_REF) on that data dir
#      -> T2/T3/T4 become private, T1 stays public, T3.label stays empty;
#   C. (repair) boot the working tree -> z073 reverts T2/T3, backfills
#      T3.label, keeps T4 private (unresolvable legacy label) and leaves T5
#      alone; the member sees T1/T2/T3 through the API and nothing else;
#   D. (fixed path) seed again from A and boot the working tree directly ->
#      the fixed z062 produces the same end state without any flip.
#
# Usage:
#   bash scripts/test-label-privacy-upgrade.sh
#   PB_BIN=/path/to/pocketbase SHIPPED_REF=<commit> bash scripts/test-label-privacy-upgrade.sh
# =============================================================================
set -euo pipefail

PB_VERSION="${PB_VERSION:-0.40.4}"
PB_PORT="${PB_PORT:-8097}"
# upstream main before the fix; the z062 loop is identical in every revision since 575c239
SHIPPED_REF="${SHIPPED_REF:-1b1d69d}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d /tmp/pb-labelpriv.XXXXXX)"
PB_PID=""
PB_URL="http://127.0.0.1:${PB_PORT}"
SEED_PASSWORD="Upgrade-Check-Password-1"

cleanup() {
  if [[ -n "$PB_PID" ]] && kill -0 "$PB_PID" 2>/dev/null; then kill "$PB_PID" 2>/dev/null || true; wait "$PB_PID" 2>/dev/null || true; fi
  rm -rf "$WORK"
}
trap cleanup EXIT
cd "$ROOT"

log() { echo "[label-privacy-upgrade] $*"; }
fail() { echo "[label-privacy-upgrade] ERROR: $*" >&2; exit 1; }

if [[ -n "${PB_BIN:-}" ]]; then
  PB="$PB_BIN"
else
  PB="$WORK/pocketbase"
  curl -fsSL "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" -o "$WORK/pb.zip"
  python3 -m zipfile -e "$WORK/pb.zip" "$WORK" >/dev/null
  chmod +x "$PB"
fi

# --- migration sets ----------------------------------------------------------
mkdir -p "$WORK/pre/pb_migrations" "$WORK/shipped/pb_migrations" "$WORK/nohooks"
for f in pb_migrations/*.js; do
  name="${f##*/}"
  if [[ "$name" < "z062" ]]; then cp "$f" "$WORK/pre/pb_migrations/$name"; fi
done
cp "$WORK/pre/pb_migrations/"*.js "$WORK/shipped/pb_migrations/"
HAVE_SHIPPED=1
if git cat-file -e "${SHIPPED_REF}^{commit}" 2>/dev/null; then
  git show "${SHIPPED_REF}:pb_migrations/z062_enforce_label_privacy.js" > "$WORK/shipped/pb_migrations/z062_enforce_label_privacy.js"
  if ! grep -q "task.get('labels')" "$WORK/shipped/pb_migrations/z062_enforce_label_privacy.js"; then
    fail "SHIPPED_REF=$SHIPPED_REF does not contain the record.get('labels') variant of z062"
  fi
else
  HAVE_SHIPPED=0
  log "notice: commit $SHIPPED_REF not available (shallow clone?) - skipping the damage/repair phases B/C"
fi

boot() { # $1 = migrations dir, $2 = hooks dir, $3 = data dir, $4 = log
  "$PB" serve --http="127.0.0.1:${PB_PORT}" --dir="$3" --migrationsDir="$1" --hooksDir="$2" >"$4" 2>&1 &
  PB_PID=$!
  for _ in $(seq 1 60); do
    if curl -fsS "$PB_URL/api/health" >/dev/null 2>&1; then return 0; fi
    if ! kill -0 "$PB_PID" 2>/dev/null; then break; fi
    sleep 1
  done
  echo "--- $4" >&2; cat "$4" >&2
  fail "PocketBase did not become healthy"
}
stop() { kill "$PB_PID"; wait "$PB_PID" 2>/dev/null || true; PB_PID=""; }

seed() { # $1 = data dir ; boots the pre-z062 schema, seeds via SQL, writes $1/seed.json
  rm -rf "$1"; mkdir -p "$1"
  boot "$WORK/pre/pb_migrations" "$WORK/nohooks" "$1" "$1.boot.log"
  stop
  "$PB" superuser upsert "seed-admin@example.test" "$SEED_PASSWORD" --dir="$1" --migrationsDir="$WORK/pre/pb_migrations" --hooksDir="$WORK/nohooks" >/dev/null
  python3 - "$1/data.db" "$1/seed.json" <<'PY'
import json, secrets, sqlite3, sys
db = sqlite3.connect(sys.argv[1])
alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
rid = lambda: ''.join(secrets.choice(alphabet) for _ in range(15))
ts = '2026-07-01 10:00:00.000Z'
pw_hash = db.execute("SELECT password FROM _superusers WHERE email = 'seed-admin@example.test'").fetchone()[0]
family, owner, member, label = rid(), rid(), rid(), rid()
db.execute("INSERT INTO families (id, name, created_by) VALUES (?, 'Upgrade family', ?)", (family, owner))
for uid, email, role in ((owner, 'owner@example.test', 'owner'), (member, 'member@example.test', 'member')):
    db.execute("INSERT INTO users (id, email, emailVisibility, verified, name, password, tokenKey, created, updated, role, family_id, member_type, member_status, language) "
               "VALUES (?, ?, 0, 1, ?, ?, ?, ?, ?, ?, ?, 'human', 'active', 'en')",
               (uid, email, email.split('@')[0], pw_hash, secrets.token_hex(25), ts, ts, role, family))
db.execute("INSERT INTO labels (id, name, color, user, created, updated, visibility, owner, family) VALUES (?, 'Household', '#8b5cf6', ?, ?, ?, 'family', ?, ?)",
           (label, owner, ts, ts, owner, family))
tasks = {
    'T1 legacy null':        (None, 0),
    'T2 legacy empty list':  ('[]', 0),
    'T3 legacy family label': (json.dumps([label]), 0),
    'T4 legacy free text':   (json.dumps(['Boodschappen']), 0),
    'T5 owner private':      ('[]', 1),
}
ids = {}
for title, (labels, private) in tasks.items():
    tid = rid(); ids[title] = tid
    db.execute("INSERT INTO tasks (id, title, user, status, is_private, labels, created, updated) VALUES (?, ?, ?, 'todo', ?, ?, ?, ?)",
               (tid, title, owner, private, labels, ts, ts))
db.commit()
json.dump({'family': family, 'owner': owner, 'member': member, 'label': label, 'tasks': ids}, open(sys.argv[2], 'w'))
PY
}

sql_state() { # $1 = data dir -> prints "title|is_private|label" for the seeded tasks
  python3 - "$1/data.db" <<'PY'
import sqlite3, sys
db = sqlite3.connect(sys.argv[1])
for title, private, label in db.execute("SELECT title, is_private, COALESCE(label, '') FROM tasks ORDER BY title"):
    print(f"{title}|{int(private)}|{label}")
PY
}

expect_state() { # $1 = data dir, $2 = expected (sorted lines), $3 = phase name
  local actual
  actual="$(sql_state "$1")"
  if [[ "$actual" != "$2" ]]; then
    echo "--- expected ($3):" >&2; echo "$2" >&2; echo "--- actual:" >&2; echo "$actual" >&2
    fail "task state after $3 differs"
  fi
  log "$3: task state as expected"
}

check_api() { # $1 = data dir (running PB with current hooks) -> member/owner visibility via the real API
  python3 - "$PB_URL" "$1/seed.json" "$SEED_PASSWORD" <<'PY'
import json, sys, urllib.request
base, seed, password = sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3]
def call(path, data=None, token=None):
    req = urllib.request.Request(base + path, data=json.dumps(data).encode() if data is not None else None,
                                 headers={'Content-Type': 'application/json', **({'Authorization': token} if token else {})})
    with urllib.request.urlopen(req) as r: return json.load(r)
def titles(email):
    token = call('/api/collections/users/auth-with-password', {'identity': email, 'password': password})['token']
    items = call('/api/collections/tasks/records?perPage=200&fields=title', token=token)['items']
    return sorted(i['title'] for i in items)
member = titles('member@example.test'); owner = titles('owner@example.test')
assert member == ['T1 legacy null', 'T2 legacy empty list', 'T3 legacy family label'], member
assert owner == sorted(seed['tasks']), owner
print('[label-privacy-upgrade] API: member sees', member)
PY
}

# PocketBase stores an empty multi-relation as '[]'
EXPECTED_SEED=$'T1 legacy null|0|[]\nT2 legacy empty list|0|[]\nT3 legacy family label|0|[]\nT4 legacy free text|0|[]\nT5 owner private|1|[]'
EXPECTED_DAMAGED=$'T1 legacy null|0|[]\nT2 legacy empty list|1|[]\nT3 legacy family label|1|[]\nT4 legacy free text|1|[]\nT5 owner private|1|[]'

final_expected() { # $1 = data dir -> expected end state (T3.label backfilled with the seeded label id)
  local label; label="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['label'])" "$1/seed.json")"
  printf 'T1 legacy null|0|[]\nT2 legacy empty list|0|[]\nT3 legacy family label|0|["%s"]\nT4 legacy free text|1|[]\nT5 owner private|1|[]' "$label"
}

# --- B + C: damage with the shipped z062, repair with the working tree -------
if [[ "$HAVE_SHIPPED" == 1 ]]; then
  log "A: seeding a pre-z062 database"
  seed "$WORK/data-repair"
  expect_state "$WORK/data-repair" "$EXPECTED_SEED" "seed"

  log "B: applying z062 as shipped ($SHIPPED_REF)"
  boot "$WORK/shipped/pb_migrations" "$WORK/nohooks" "$WORK/data-repair" "$WORK/data-repair.shipped.log"
  stop
  expect_state "$WORK/data-repair" "$EXPECTED_DAMAGED" "shipped z062 (damage reproduced)"
  # The impact query published with #237 (what an operator runs before
  # upgrading) must list exactly the tasks z062 flipped.
  python3 - "$WORK/data-repair/data.db" <<'PY'
import sqlite3, sys
db = sqlite3.connect(sys.argv[1])
rows = db.execute("""
WITH m AS (SELECT applied FROM _migrations WHERE file = 'z062_enforce_label_privacy.js')
SELECT t.title, t.labels FROM tasks t, m
WHERE (t.is_private = 1 OR t.is_private = 'true')
  AND COALESCE(t.label, '') IN ('', '[]', 'null')
  AND t.labels IS NOT NULL AND TRIM(t.labels) NOT IN ('', 'null')
  AND t.updated >= strftime('%Y-%m-%d %H:%M:%fZ', m.applied / 1000000.0 - 600, 'unixepoch')
  AND t.updated <= strftime('%Y-%m-%d %H:%M:%fZ', m.applied / 1000000.0, 'unixepoch')
ORDER BY t.title""").fetchall()
titles = [r[0] for r in rows]
assert titles == ['T2 legacy empty list', 'T3 legacy family label', 'T4 legacy free text'], titles
print('[label-privacy-upgrade] impact query: ' + '; '.join(f'{t} (labels={l})' for t, l in rows))
PY

  log "C: upgrading to the working tree (z073 repair)"
  boot "$ROOT/pb_migrations" "$ROOT/pb_hooks" "$WORK/data-repair" "$WORK/data-repair.current.log"
  grep -E '^\[z073\]|\[z073\]' "$WORK/data-repair.current.log" || true
  expect_state "$WORK/data-repair" "$(final_expected "$WORK/data-repair")" "z073 repair"
  check_api "$WORK/data-repair"
  stop
  # idempotency: a second boot must not touch anything
  boot "$ROOT/pb_migrations" "$ROOT/pb_hooks" "$WORK/data-repair" "$WORK/data-repair.again.log"
  stop
  expect_state "$WORK/data-repair" "$(final_expected "$WORK/data-repair")" "second boot (idempotent)"
fi

# --- E: a privacy decision made after z062 is never reverted ---------------
# The owner touched "T2" after the shipped z062 ran (it stayed private): its
# last write is outside the z062 window, so z073 must leave it alone while
# still repairing the untouched T3.
if [[ "$HAVE_SHIPPED" == 1 ]]; then
  log "E: owner changes a flipped task after z062; z073 must keep that decision"
  seed "$WORK/data-later"
  boot "$WORK/shipped/pb_migrations" "$WORK/nohooks" "$WORK/data-later" "$WORK/data-later.shipped.log"
  stop
  python3 - "$WORK/data-later/data.db" <<'PY'
import sqlite3, sys
db = sqlite3.connect(sys.argv[1])
applied = db.execute("SELECT applied FROM _migrations WHERE file = 'z062_enforce_label_privacy.js'").fetchone()[0]
later = db.execute("SELECT strftime('%Y-%m-%d %H:%M:%fZ', ? / 1000000.0 + 3600, 'unixepoch')", (applied,)).fetchone()[0]
db.execute("UPDATE tasks SET updated = ? WHERE title = 'T2 legacy empty list'", (later,))
db.commit()
PY
  boot "$ROOT/pb_migrations" "$ROOT/pb_hooks" "$WORK/data-later" "$WORK/data-later.current.log"
  stop
  label="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['label'])" "$WORK/data-later/seed.json")"
  expect_state "$WORK/data-later" "$(printf 'T1 legacy null|0|[]\nT2 legacy empty list|1|[]\nT3 legacy family label|0|["%s"]\nT4 legacy free text|1|[]\nT5 owner private|1|[]' "$label")" "later owner decision kept"
fi

# --- D: the fixed upgrade path ----------------------------------------------
log "D: seeding a pre-z062 database and upgrading straight to the working tree"
seed "$WORK/data-fixed"
expect_state "$WORK/data-fixed" "$EXPECTED_SEED" "seed"
boot "$ROOT/pb_migrations" "$ROOT/pb_hooks" "$WORK/data-fixed" "$WORK/data-fixed.current.log"
expect_state "$WORK/data-fixed" "$(final_expected "$WORK/data-fixed")" "fixed z062"
check_api "$WORK/data-fixed"
stop

echo "PASS: z062 no longer flips legacy tasks private and z073 repairs databases it already flipped."
