#!/usr/bin/env bash
# scripts/anonymize-prod-to-dev.py against a REAL PocketBase database.
#
# Seeds a production-like database (real PocketBase + this repo's
# migrations, so every UNIQUE index is real): 9 users, 2 superusers,
# SMTP/S3/backup-S3 credentials and sender identity in the settings row,
# tasks and calendar events with external identifiers. Then:
#   1. a failure injected halfway leaves no output (no db, -wal, -shm);
#   2. a normal run leaves ZERO occurrences of any seeded secret or identity
#      anywhere in the output file;
#   3. PocketBase boots on the sanitized copy, the documented dev superuser
#      and user logins work, SMTP/S3 are disabled and blank;
#   4. an encrypted settings row (ENCRYPTION_KEY) is removed, and PocketBase
#      boots on the copy WITHOUT the production key.
#
#   PB_BIN=/path/to/pocketbase bash scripts/test-anonymizer.sh
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib/pocketbase.sh"
PB_PORT="${PB_PORT:-8093}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d /tmp/todoless-anon-test.XXXXXX)"
PB_URL="http://127.0.0.1:${PB_PORT}"
PB_PID=""
cleanup() { [[ -n "$PB_PID" ]] && kill "$PB_PID" 2>/dev/null || true; rm -rf "$WORK"; }
trap cleanup EXIT
log() { echo "[anon-test] $*"; }
fail() { echo "FAIL: $*" >&2; exit 1; }

PB="$(pocketbase_bin "$WORK")"

boot() { # $1 = data dir, extra args...
  local dir="$1"; shift
  "$PB" serve --http="127.0.0.1:${PB_PORT}" --dir="$dir" --migrationsDir="$ROOT/pb_migrations" \
    --hooksDir="$ROOT/pb_hooks" --automigrate=false "$@" >"$dir.log" 2>&1 &
  PB_PID=$!
  for _ in $(seq 1 60); do
    curl -fsS "$PB_URL/api/health" >/dev/null 2>&1 && return 0
    kill -0 "$PB_PID" 2>/dev/null || break
    sleep 0.5
  done
  cat "$dir.log" >&2; return 1
}
stop() { kill "$PB_PID"; wait "$PB_PID" 2>/dev/null || true; PB_PID=""; }

# Seeded "production" values -- every one must be gone afterwards.
SECRETS=(prod-smtp-pass-7Hq2 smtp.prod-mail.example prod-smtp-user prod-s3-secret-K8w1 prod-s3-access-AKIA9
         prod-backup-secret-Z3p0 prod-backup-access-AKIB7 prod-bucket-x1 sender@prod-family.example
         https://todo.prod-family.example 203.0.113.77 ics-uid-prod-1@icloud.example ext-prod-task-55
         ics-uid-prod-event@google.example ext-prod-event-66 root@prod-family.example ops@prod-family.example)

seed() { # $1 = data dir, $2 = "plain" | "encrypted"
  local dir="$1" mode="$2" enc=()
  [[ "$mode" == encrypted ]] && enc=(--encryptionEnv=ANON_TEST_KEY)
  "$PB" superuser upsert root@prod-family.example "Prod-Root-Passw0rd" --dir="$dir" --migrationsDir="$ROOT/pb_migrations" --hooksDir="$ROOT/pb_hooks" >/dev/null
  "$PB" superuser upsert ops@prod-family.example "Prod-Ops-Passw0rd" --dir="$dir" --migrationsDir="$ROOT/pb_migrations" --hooksDir="$ROOT/pb_hooks" >/dev/null
  ANON_TEST_KEY="0123456789abcdef0123456789abcdef" boot "$dir" "${enc[@]}"
  python3 - "$PB_URL" <<'PY'
import json, sys, urllib.request
base = sys.argv[1]
def call(method, path, data=None, token=None):
    req = urllib.request.Request(base + path, method=method, data=json.dumps(data).encode() if data is not None else None,
                                 headers={'Content-Type': 'application/json', **({'Authorization': token} if token else {})})
    with urllib.request.urlopen(req) as r: return json.load(r)
tok = call('POST', '/api/collections/_superusers/auth-with-password', {'identity': 'root@prod-family.example', 'password': 'Prod-Root-Passw0rd'})['token']
call('PATCH', '/api/settings', {
  'meta': {'appURL': 'https://todo.prod-family.example', 'senderName': 'Prod Family', 'senderAddress': 'sender@prod-family.example'},
  'smtp': {'enabled': True, 'host': 'smtp.prod-mail.example', 'port': 587, 'username': 'prod-smtp-user', 'password': 'prod-smtp-pass-7Hq2', 'authMethod': 'PLAIN'},
  's3': {'enabled': True, 'bucket': 'prod-bucket-x1', 'region': 'eu', 'endpoint': 'https://s3.example', 'accessKey': 'prod-s3-access-AKIA9', 'secret': 'prod-s3-secret-K8w1'},
  'backups': {'cron': '0 2 * * *', 'cronMaxKeep': 7, 's3': {'enabled': True, 'bucket': 'prod-bucket-x1', 'region': 'eu', 'endpoint': 'https://s3.example', 'accessKey': 'prod-backup-access-AKIB7', 'secret': 'prod-backup-secret-Z3p0'}},
  'superuserIPs': ['203.0.113.77'],
}, tok)
PY
  stop
  python3 - "$dir/data.db" <<'PY'
import secrets, sqlite3, sys
db = sqlite3.connect(sys.argv[1]); rid = lambda: secrets.token_hex(8)[:15]
ts = '2026-07-01 10:00:00.000Z'
pw = db.execute("SELECT password FROM _superusers LIMIT 1").fetchone()[0]
owner, fam = rid(), rid()
db.execute("INSERT INTO families (id, name, created_by) VALUES (?, 'The Prod Family', ?)", (fam, owner))
for n in range(9):
    uid = owner if n == 0 else rid()
    db.execute("INSERT INTO users (id, email, emailVisibility, verified, name, password, tokenKey, created, updated, role, family_id, member_type, member_status, language) "
               "VALUES (?, ?, 0, 1, ?, ?, ?, ?, ?, ?, ?, 'human', 'active', 'en')",
               (uid, f'person{n}@prod-family.example', f'Real Person {n}', pw, secrets.token_hex(25), ts, ts, 'owner' if n == 0 else 'member', fam))
db.execute("INSERT INTO tasks (id, title, user, status, uid, external_id, source, created, updated) VALUES (?, 'Real task', ?, 'todo', 'ics-uid-prod-1@icloud.example', 'ext-prod-task-55', 'ics', ?, ?)", (rid(), owner, ts, ts))
cols = {c[1] for c in db.execute("PRAGMA table_info(calendar_events)")}
if {'uid', 'external_id', 'family'} <= cols:
    db.execute("INSERT INTO calendar_events (id, title, user, family, uid, external_id, created, updated) VALUES (?, 'Real event', ?, ?, 'ics-uid-prod-event@google.example', 'ext-prod-event-66', ?, ?)", (rid(), owner, fam, ts, ts))
db.commit()
PY
}

assert_clean() { # $1 = sanitized db
  python3 - "$1" "${SECRETS[@]}" <<'PY'
import sqlite3, sys
path, needles = sys.argv[1], sys.argv[2:]
blob = open(path, 'rb').read()
hits = [n for n in needles if n.encode() in blob]
assert not hits, f'seeded production values still present: {hits}'
db = sqlite3.connect(path)
emails = [r[0] for r in db.execute("SELECT email FROM users")]
assert len(emails) == 9 and len(set(emails)) == 9, emails
su = [r[0] for r in db.execute("SELECT email FROM _superusers")]
assert len(su) == 2 and len(set(su)) == 2 and 'admin@example.test' in su, su
assert not any('prod-family' in e for e in emails + su)
assert db.execute("SELECT COUNT(*) FROM tasks WHERE uid != '' OR external_id != ''").fetchone()[0] == 0
print(f'[anon-test] no seeded value in {len(blob)} bytes; 9 unique users, 2 unique superusers')
PY
}

# --- 1. failure halfway: nothing that looks like a safe copy survives --------
log "seeding a production-like database (plain settings)"
seed "$WORK/prod" plain
# Sanity: the source really contains every seeded value (else step 2 proves nothing).
python3 - "$WORK/prod/data.db" "${SECRETS[@]}" <<'PY'
import sqlite3, sys
db = sqlite3.connect(sys.argv[1]); db.execute("PRAGMA wal_checkpoint(TRUNCATE)"); db.close()
blob = open(sys.argv[1], 'rb').read()
missing = [n for n in sys.argv[2:] if n.encode() not in blob]
assert not missing, f'seeding did not write: {missing}'
PY
for at in after-users after-tasks; do
  set +e
  TODOLESS_ANONYMIZE_FAIL_AT="$at" python3 "$ROOT/scripts/anonymize-prod-to-dev.py" "$WORK/prod/data.db" "$WORK/out_anon.db" >"$WORK/fail.log" 2>&1
  rc=$?; set -e
  [[ $rc -ne 0 ]] || fail "injected failure ($at) did not fail the run"
  leftovers="$(ls "$WORK" | grep -E '^out_anon\.db' || true)"
  [[ -z "$leftovers" ]] || fail "failed run ($at) left: $leftovers"
  log "failure at $at: exit $rc, no output files left"
done

# --- 2/3. normal run, literal search, PocketBase boots on the copy ----------
python3 "$ROOT/scripts/anonymize-prod-to-dev.py" "$WORK/prod/data.db" "$WORK/out_anon.db" >"$WORK/run.log"
[[ ! -e "$WORK/out_anon.db-wal" && ! -e "$WORK/out_anon.db-shm" ]] || fail "output left -wal/-shm siblings"
assert_clean "$WORK/out_anon.db"
mkdir -p "$WORK/dev"; cp "$WORK/out_anon.db" "$WORK/dev/data.db"
boot "$WORK/dev" || fail "PocketBase did not boot on the sanitized copy"
python3 - "$PB_URL" <<'PY'
import json, sys, urllib.request
base = sys.argv[1]
def call(method, path, data=None, token=None):
    req = urllib.request.Request(base + path, method=method, data=json.dumps(data).encode() if data is not None else None,
                                 headers={'Content-Type': 'application/json', **({'Authorization': token} if token else {})})
    with urllib.request.urlopen(req) as r: return json.load(r)
su = call('POST', '/api/collections/_superusers/auth-with-password', {'identity': 'admin@example.test', 'password': 'test1234'})['token']
call('POST', '/api/collections/users/auth-with-password', {'identity': 'admin@example.test', 'password': 'test1234'})
s = call('GET', '/api/settings', token=su)
assert s['smtp']['enabled'] is False and s['smtp']['host'] == '' and s['smtp']['username'] == '', s['smtp']
assert s['s3']['enabled'] is False and s['s3']['accessKey'] == '' and s['s3']['bucket'] == '', s['s3']
assert s['backups']['s3']['enabled'] is False and s['backups']['s3']['accessKey'] == '', s['backups']
assert s['meta']['senderAddress'] == 'noreply@example.test' and 'prod' not in s['meta']['appURL'], s['meta']
assert s['superuserIPs'] == [], s['superuserIPs']
print('[anon-test] PocketBase boots on the copy; dev logins work; SMTP/S3/backup-S3 disabled and blank')
PY
stop

# --- 4. encrypted settings row: removed; boots without the production key ---
log "seeding a production-like database (settings encrypted with ENCRYPTION_KEY)"
seed "$WORK/prod-enc" encrypted
python3 - "$WORK/prod-enc/data.db" <<'PY'
import json, sqlite3, sys
raw = sqlite3.connect(sys.argv[1]).execute("SELECT value FROM _params WHERE id='settings'").fetchone()[0]
try: json.loads(raw); raise SystemExit('settings row is not encrypted - test setup broken')
except ValueError: pass
PY
python3 "$ROOT/scripts/anonymize-prod-to-dev.py" "$WORK/prod-enc/data.db" "$WORK/enc_anon.db" >"$WORK/run-enc.log"
grep -q "encrypted/unreadable settings row deleted" "$WORK/run-enc.log" || fail "encrypted settings row was not removed"
assert_clean "$WORK/enc_anon.db"
mkdir -p "$WORK/dev-enc"; cp "$WORK/enc_anon.db" "$WORK/dev-enc/data.db"
boot "$WORK/dev-enc" || fail "PocketBase did not boot on the copy without the production key"
curl -fsS -o /dev/null "$PB_URL/api/health"
stop
log "encrypted settings row removed; PocketBase boots on the copy without the production key"

echo "PASS: the anonymizer removes every seeded secret/identity, never leaves output after a failure, and its result boots."
