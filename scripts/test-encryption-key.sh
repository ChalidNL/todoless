#!/usr/bin/env bash
# ENCRYPTION_KEY lifecycle against the REAL PocketBase binary (#243).
#
#   1. clean install without a key: settings are stored as plain JSON
#   2. start with a valid 32-character key: plain settings stay readable
#   3. saving settings with the key stores them encrypted
#   4. restart with the same key: settings readable
#   5. restart WITHOUT the key: PocketBase refuses to start
#   6. restart with a WRONG key: PocketBase refuses to start
#   7. a key of the wrong length: the entrypoint warns and passes no flag
#      (covered with the real entrypoint by scripts/test-entrypoint-env.sh);
#      on an encrypted database PocketBase then refuses to start (asserted)
#   8. a backup restored into a fresh data dir starts with the same key
#
#   PB_BIN=/path/to/pocketbase bash scripts/test-encryption-key.sh
set -euo pipefail

PB_VERSION="${PB_VERSION:-0.40.4}"
PB_PORT="${PB_PORT:-8092}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d /tmp/todoless-enc-test.XXXXXX)"
PB_URL="http://127.0.0.1:${PB_PORT}"
PB_PID=""
cleanup() { [[ -n "$PB_PID" ]] && kill "$PB_PID" 2>/dev/null || true; rm -rf "$WORK"; }
trap cleanup EXIT
log() { echo "[encryption-key] $*"; }
fail() { echo "FAIL: $*" >&2; exit 1; }

if [[ -n "${PB_BIN:-}" ]]; then PB="$PB_BIN"; else
  PB="$WORK/pocketbase"
  curl -fsSL "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" -o "$WORK/pb.zip"
  python3 -m zipfile -e "$WORK/pb.zip" "$WORK" >/dev/null; chmod +x "$PB"
fi

KEY="$(python3 -c 'import secrets; print(secrets.token_hex(16))')"      # 32 characters
WRONG="$(python3 -c 'import secrets; print(secrets.token_hex(16))')"
SU_PASSWORD="$(python3 -c 'import secrets; print(secrets.token_hex(16))')"
DATA="$WORK/pb_data"

serve() { # $1 = data dir, $2 = key ("" = no --encryptionEnv); returns non-zero if PB does not become healthy
  local dir="$1" key="$2" args=()
  [[ -n "$key" ]] && args=(--encryptionEnv=TODOLESS_TEST_KEY)
  TODOLESS_TEST_KEY="$key" "$PB" serve --http="127.0.0.1:${PB_PORT}" --dir="$dir" --migrationsDir="$ROOT/pb_migrations" \
    --hooksDir="$ROOT/pb_hooks" --automigrate=false "${args[@]}" >"$WORK/serve.log" 2>&1 &
  PB_PID=$!
  for _ in $(seq 1 40); do
    curl -fsS "$PB_URL/api/health" >/dev/null 2>&1 && return 0
    kill -0 "$PB_PID" 2>/dev/null || { wait "$PB_PID" 2>/dev/null || true; PB_PID=""; return 1; }
    sleep 0.5
  done
  return 1
}
stop() { kill "$PB_PID"; wait "$PB_PID" 2>/dev/null || true; PB_PID=""; }
api() { # method path [json] -> body (superuser)
  python3 - "$PB_URL" "$SU_PASSWORD" "$@" <<'PY'
import json, sys, urllib.request
base, pw, method, path = sys.argv[1:5]
data = sys.argv[5] if len(sys.argv) > 5 else None
def call(m, p, d=None, t=None):
    r = urllib.request.Request(base + p, method=m, data=d.encode() if d else None,
                               headers={'Content-Type': 'application/json', **({'Authorization': t} if t else {})})
    with urllib.request.urlopen(r) as x:
        body = x.read()
        return json.loads(body) if body else {}
t = call('POST', '/api/collections/_superusers/auth-with-password', json.dumps({'identity': 'root@example.test', 'password': pw}))['token']
print(json.dumps(call(method, path, data, t)))
PY
}
row_is_json() { python3 - "$1/data.db" <<'PY'
import json, sqlite3, sys
raw = sqlite3.connect(sys.argv[1]).execute("SELECT value FROM _params WHERE id='settings'").fetchone()[0]
try: json.loads(raw); print('plain')
except ValueError: print('encrypted')
PY
}

"$PB" superuser upsert root@example.test "$SU_PASSWORD" --dir="$DATA" --migrationsDir="$ROOT/pb_migrations" --hooksDir="$ROOT/pb_hooks" >/dev/null

log "1. clean install without a key"
serve "$DATA" "" || fail "fresh install did not start"
api PATCH /api/settings '{"smtp":{"enabled":false,"host":"smtp.before-key.example"}}' >/dev/null
stop
[[ "$(row_is_json "$DATA")" == plain ]] || fail "settings not plain without a key"

log "2./3. valid key: plain settings readable, next save stores them encrypted"
serve "$DATA" "$KEY" || fail "did not start with a valid key on plain settings"
api GET /api/settings | grep -q smtp.before-key.example || fail "plain settings unreadable after enabling the key"
api PATCH /api/settings '{"smtp":{"enabled":false,"host":"smtp.with-key.example"}}' >/dev/null
stop
[[ "$(row_is_json "$DATA")" == encrypted ]] || fail "settings not encrypted after saving with the key"

log "4. restart with the same key"
serve "$DATA" "$KEY" || fail "did not restart with the correct key"
api GET /api/settings | grep -q smtp.with-key.example || fail "settings unreadable with the correct key"
api POST /api/backups '{"name":"enc_test.zip"}' >/dev/null
stop

log "5. restart without the key"
if serve "$DATA" ""; then stop; fail "started WITHOUT the key on encrypted settings"; fi
grep -q "missing encryption key" "$WORK/serve.log" || { cat "$WORK/serve.log"; fail "unexpected error without the key"; }

log "6. restart with a wrong key"
if serve "$DATA" "$WRONG"; then stop; fail "started with a WRONG key"; fi

log "7. key of the wrong length (entrypoint passes no flag) on an encrypted database"
if serve "$DATA" ""; then stop; fail "started without a usable key"; fi

log "8. restore the backup into a fresh data dir and start with the key"
mkdir -p "$WORK/restored"
python3 -m zipfile -e "$DATA/backups/enc_test.zip" "$WORK/restored" >/dev/null
serve "$WORK/restored" "$KEY" || fail "restored backup did not start with the key"
api GET /api/settings | grep -q smtp.with-key.example || fail "restored settings unreadable with the key"
stop
if serve "$WORK/restored" ""; then stop; fail "restored backup started WITHOUT the key"; fi

echo "PASS: ENCRYPTION_KEY is opt-in, encrypts on the next settings save, and the same key is required to start (also after a restore)."
