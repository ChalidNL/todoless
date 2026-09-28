#!/usr/bin/env bash
# GH#37 verification harness — real PocketBase 0.35.1 upgrade path.
#
# Phase 1: boot PB with the pre-fix migration set (repo minus 071_rotate),
#          create 3 users (bootstrap + invite flow), plant Math.random-style
#          weak tokenKeys directly in SQLite (simulating what 060 produced).
# Phase 2: boot PB with the FULL migration set (incl. 071) on the SAME data
#          dir. PB detects 071 as an unapplied migration and runs the
#          rotation. We then verify tokenKeys changed, are 50 chars, and
#          password auth still issues a fresh session.
#
# Usage: bash verify-gh37.sh <repo-root> <pb-binary>
set -euo pipefail

ROOT="$(cd "$1" && pwd)"
PB="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
PORT="${PORT:-8094}"
WORK="$(mktemp -d /tmp/gh37-verify.XXXXXX)"
DATA="$WORK/pb_data"
PRE_MIG="$WORK/pre_migrations"
LOG1="$WORK/pb-phase1.log"
LOG2="$WORK/pb-phase2.log"
PID1=""
PID2=""

cleanup() {
  [[ -n "$PID1" ]] && kill "$PID1" 2>/dev/null || true
  [[ -n "$PID2" ]] && kill "$PID2" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT

echo "workdir: $WORK"
mkdir -p "$DATA" "$PRE_MIG"
# Pre-fix migration set = repo minus 071_rotate_user_token_keys.js
for f in "$ROOT"/pb_migrations/*.js; do
  base="$(basename "$f")"
  [[ "$base" == "071_rotate_user_token_keys.js" ]] && continue
  cp "$f" "$PRE_MIG/"
done
echo "pre-fix migrations: $(ls "$PRE_MIG" | wc -l) / full: $(ls "$ROOT"/pb_migrations | wc -l)"

BASE="http://127.0.0.1:$PORT"
PASS='weakpass-gh37-123'

# ---------- Phase 1: boot pre-fix, seed users, plant weak keys ----------
"$PB" serve --http="127.0.0.1:$PORT" --dir="$DATA" \
  --migrationsDir="$PRE_MIG" --hooksDir="$ROOT/pb_hooks" --automigrate \
  >"$LOG1" 2>&1 &
PID1=$!
ready=0
for i in $(seq 1 90); do
  if curl -fsS "$BASE/api/hook-health" >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
if [[ "$ready" != "1" ]]; then
  echo "PHASE1 BOOT FAILED"; tail -40 "$LOG1"; exit 1
fi
echo "phase1: PB healthy (pre-fix, 071 absent)"

# Bootstrap user (first account = admin + family)
alice=$(curl -s -X POST "$BASE/api/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"alice@gh37.test\",\"password\":\"$PASS\",\"passwordConfirm\":\"$PASS\",\"name\":\"Alice\",\"user_type\":\"family_member\"}")
echo "phase1: register alice -> $(echo "$alice" | head -c 120)"

# Login as alice to get admin token
atok=$(curl -s -X POST "$BASE/api/collections/users/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"alice@gh37.test\",\"password\":\"$PASS\"}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('token',''))")
echo "phase1: alice token len=${#atok}"

# Create invite codes for bob and carol and register them
for u in bob carol; do
  inv=$(curl -s -X POST "$BASE/api/invites/create" -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $atok" -d '{"type":"human"}')
  code=$(echo "$inv" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('code',''))")
  echo "phase1: invite for $u -> $code"
  reg=$(curl -s -X POST "$BASE/api/register" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$u@gh37.test\",\"password\":\"$PASS\",\"passwordConfirm\":\"$PASS\",\"name\":\"$u\",\"user_type\":\"family_member\",\"invite_code\":\"$code\"}")
  echo "phase1: register $u -> $(echo "$reg" | head -c 120)"
done

# Plant a Math.random-style weak tokenKey for each user in SQLite.
# 060 produced 50-char alphanumeric via Math.random; a deterministic
# "WEAK" value with a known suffix makes rotation provable.
python3 - "$DATA/data.db" <<'PY'
import sqlite3, sys
con = sqlite3.connect(sys.argv[1])
cur = con.cursor()
users = cur.execute("SELECT id, email FROM users").fetchall()
print("users found:", users)
assert len(users) >= 3, f"expected >=3 users, got {len(users)}"
for i, (uid, email) in enumerate(users):
    weak = ("WEAK" * 10)[:47] + f"{i:03d}"  # 50 chars, deterministic marker
    cur.execute("UPDATE users SET tokenKey=? WHERE id=?", (weak, uid))
    print("planted weak key", weak, "for", email)
con.commit(); con.close()
PY

kill "$PID1"; wait "$PID1" 2>/dev/null || true; PID1=""
echo "phase1: stopped"

# ---------- Phase 2: boot WITH 071, verify rotation ----------
"$PB" serve --http="127.0.0.1:$PORT" --dir="$DATA" \
  --migrationsDir="$ROOT/pb_migrations" --hooksDir="$ROOT/pb_hooks" --automigrate \
  >"$LOG2" 2>&1 &
PID2=$!
ready=0
for i in $(seq 1 90); do
  if curl -fsS "$BASE/api/hook-health" >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
if [[ "$ready" != "1" ]]; then
  echo "PHASE2 BOOT FAILED"; tail -60 "$LOG2"; exit 1
fi
echo "phase2: PB healthy (071 present)"

# Verify in SQLite
python3 - "$DATA/data.db" <<'PY'
import sqlite3, sys
con = sqlite3.connect(sys.argv[1])
cur = con.cursor()
applied = [r[0] for r in cur.execute("SELECT file FROM _migrations WHERE file LIKE '%rotate_user_token_keys%'").fetchall()]
print("071 migration applied:", applied)
assert applied, "071_rotate_user_token_keys.js was NOT applied!"
users = cur.execute("SELECT email, tokenKey FROM users ORDER BY email").fetchall()
assert users, "no users found"
ok = True
for email, key in users:
    weak = str(key).startswith("WEAK")
    good = len(key) == 50 and key.isalnum() and not weak
    print(f"  {email}: len={len(key)} alnum={key.isalnum()} rotated={good}")
    ok = ok and good
assert ok, "not all tokenKeys were rotated to fresh 50-char secure values"
con.close()
print("ROTATION OK: all tokenKeys regenerated (50 chars, not the planted weak value)")
PY

# Auth must still work and issue a fresh session
for u in alice bob carol; do
  resp=$(curl -s -X POST "$BASE/api/collections/users/auth-with-password" \
    -H 'Content-Type: application/json' \
    -d "{\"identity\":\"$u@gh37.test\",\"password\":\"$PASS\"}")
  tok=$(echo "$resp" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('token',''))")
  if [[ ${#tok} -gt 20 ]]; then
    echo "auth $u: OK (token len ${#tok})"
  else
    echo "auth $u: FAILED -> $resp"; exit 1
  fi
done

echo "=== GH#37 VERIFICATION PASSED ==="
rm -rf "$WORK"