#!/usr/bin/env bash
# Registration races and owner-role rules against the REAL PocketBase binary
# (review S10, S9, S14). Needs fresh databases, so it is not part of the
# shared smoke suite.
#   1. 8 parallel first registrations -> exactly one admin + family
#   2. 8 parallel registrations with one single-use invite -> one account
#   3. the owner is never demoted; only the owner transfers ownership
#
#   PB_BIN=/path/to/pocketbase bash scripts/test-registration-and-roles.sh
set -euo pipefail
PB_VERSION="${PB_VERSION:-0.40.4}"
PB_PORT="${PB_PORT:-8091}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d /tmp/todoless-reg-test.XXXXXX)"
PB_PID=""
cleanup() { [[ -n "$PB_PID" ]] && kill "$PB_PID" 2>/dev/null || true; rm -rf "$WORK"; }
trap cleanup EXIT
if [[ -n "${PB_BIN:-}" ]]; then PB="$PB_BIN"; else
  PB="$WORK/pocketbase"
  curl -fsSL "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" -o "$WORK/pb.zip"
  python3 -m zipfile -e "$WORK/pb.zip" "$WORK" >/dev/null; chmod +x "$PB"
fi
boot() {
  "$PB" serve --http="127.0.0.1:${PB_PORT}" --dir="$1" --migrationsDir="$ROOT/pb_migrations" --hooksDir="$ROOT/pb_hooks" --automigrate=false >"$1.log" 2>&1 &
  PB_PID=$!
  for _ in $(seq 1 60); do curl -fsS "http://127.0.0.1:${PB_PORT}/api/health" >/dev/null 2>&1 && return 0; sleep 0.5; done
  cat "$1.log" >&2; exit 1
}
stop() { kill "$PB_PID"; wait "$PB_PID" 2>/dev/null || true; PB_PID=""; }

boot "$WORK/races"
python3 - "http://127.0.0.1:${PB_PORT}" <<'PY'
import json, sys, threading, urllib.request, urllib.error
B = sys.argv[1]; PW = 'Race-Passw0rd-1'
def req(m, p, d=None, t=None):
    r = urllib.request.Request(B + p, method=m, data=json.dumps(d).encode() if d is not None else None,
                               headers={'Content-Type': 'application/json', **({'Authorization': 'Bearer ' + t} if t else {})})
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.loads(x.read() or b'{}')
    except urllib.error.HTTPError as e: return e.code, {}
def reg(e, **kw): return req('POST', '/api/register', {'email': e, 'password': PW, 'passwordConfirm': PW, 'name': e, 'user_type': 'family_member', 'language': 'en', **kw})[0]
def can_login(e): return req('POST', '/api/collections/users/auth-with-password', {'identity': e, 'password': PW})[0] == 200
def race(fn, n=8):
    out = []; ths = [threading.Thread(target=lambda i=i: out.append(fn(i))) for i in range(n)]
    [t.start() for t in ths]; [t.join() for t in ths]; return sorted(out)
codes = race(lambda i: reg(f'first{i}@race.test', family_name=f'Fam {i}'))
accounts = [i for i in range(8) if can_login(f'first{i}@race.test')]
assert codes.count(201) == 1 and len(accounts) == 1, f'parallel first registrations: {codes}, accounts {accounts}'
print(f'[registration] 8 parallel first registrations -> {codes} (one admin, one family)')
admin = f'first{accounts[0]}@race.test'
tok = req('POST', '/api/collections/users/auth-with-password', {'identity': admin, 'password': PW})[1]['token']
code = req('POST', '/api/invites/create', {'type': 'human'}, tok)[1]['code']
codes = race(lambda i: reg(f'inv{i}@race.test', invite_code=code))
accounts = [i for i in range(8) if can_login(f'inv{i}@race.test')]
assert codes.count(201) == 1 and len(accounts) == 1, f'one invite, parallel use: {codes}, accounts {accounts}'
print(f'[registration] one single-use invite used 8x in parallel -> {codes} (one account)')
PY
stop

boot "$WORK/roles"
python3 "$ROOT/tests/registration/owner-roles.py" "http://127.0.0.1:${PB_PORT}"
stop
echo "PASS: registration is race-free and the owner role cannot be taken over or lost."
