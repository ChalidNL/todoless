#!/usr/bin/env bash
# =============================================================================
# Entrypoint environment contract
#
# 1. Every variable .env.example documents for the PocketBase runtime
#    (settings bootstrap z067, mail webhook, superuser bootstrap, encryption)
#    is actually passed through by docker-compose.yml - a documented knob that
#    compose does not forward silently does nothing (SMTP_AUTH_METHOD was one).
# 2. .env.example documents no variable that nothing reads.
# 3. ENCRYPTION_KEY handling in pocketbase-entrypoint.sh: no key -> no flag;
#    a 32-character key -> --encryptionEnv=ENCRYPTION_KEY is appended to the
#    serve command; any other length -> warning, no flag (PocketBase would
#    refuse to start otherwise).
#
# Runs the real entrypoint with PB_* overrides and a stub `pocketbase` that
# records its arguments (same technique as scripts/test-stale-cleanup.sh).
#
# Usage: bash scripts/test-entrypoint-env.sh
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d /tmp/entrypoint-env.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
FAIL=0
MARK=0
fail() { FAIL=$((FAIL + 1)); echo "[entrypoint-env] FAIL: $*" >&2; }
ok() { if [[ "$FAIL" == "$MARK" ]]; then echo "[entrypoint-env] ok: $*"; fi; MARK=$FAIL; }

# ── 1 + 2: .env.example vs docker-compose.yml / readers ─────────────────────
documented="$(grep -oE '^[A-Z_]+=' "$ROOT/.env.example" | tr -d '=' | sort -u)"
# Variables the pocketbase container must receive from compose.
runtime_vars="APP_NAME APP_URL SMTP_HOST SMTP_PORT SMTP_USERNAME SMTP_PASSWORD SMTP_FROM SMTP_AUTH_METHOD TRUSTED_PROXY_HEADERS TRUSTED_PROXY_USE_LEFTMOST_IP MAIL_WEBHOOK_SECRET POCKETBASE_ADMIN_EMAIL POCKETBASE_ADMIN_PASSWORD LOG_LEVEL ENCRYPTION_KEY TZ"
for v in $runtime_vars; do
  grep -qE "^\s+$v: \\\$\{$v" "$ROOT/docker-compose.yml" || fail "$v is documented in .env.example but docker-compose.yml does not pass it to the container"
done
ok "compose forwards every runtime variable"

# Build-time / compose-only variables that are legitimately not read by the container.
compose_or_build="REGISTRY TODOLESS_TAG TODOLESS_PORT TZ COMMIT_SHA PB_DATA_DIR VITE_GIT_COMMIT VITE_APP_VERSION"
for v in $documented; do
  case " $runtime_vars $compose_or_build " in
    *" $v "*) continue ;;
  esac
  # anything else must be read somewhere in the runtime code
  if ! grep -rqE "\b$v\b" "$ROOT/pb_hooks" "$ROOT/pb_migrations" "$ROOT/pocketbase-entrypoint.sh" "$ROOT/docker-compose.yml" "$ROOT/vite.config.ts" "$ROOT/Dockerfile.frontend" 2>/dev/null; then
    fail "$v is documented in .env.example but nothing reads it"
  fi
done
ok ".env.example documents no dead variable"
dups="$(grep -oE '^[A-Z_]+=' "$ROOT/.env.example" | sort | uniq -d | tr -d '=' | tr '\n' ' ')"
[[ -z "$dups" ]] || fail ".env.example lists variables twice: $dups"

# ── 3: ENCRYPTION_KEY handling ──────────────────────────────────────────────
mkdir -p "$TMP/bin" "$TMP/pb_data" "$TMP/migrations" "$TMP/migrations_bundled" "$TMP/hooks" "$TMP/hooks_bundled" "$TMP/manifests"
printf '#!/bin/sh\nexit 0\n' > "$TMP/bin/sqlite3"; chmod +x "$TMP/bin/sqlite3"
cat > "$TMP/bin/pocketbase" <<'STUB'
#!/bin/sh
# ENTRYPOINT-ENV-STUB: record the serve arguments
if [ "$1" = "serve" ]; then printf '%s\n' "$@" > "$STUB_ARGS_FILE"; fi
exit 0
STUB
chmod +x "$TMP/bin/pocketbase"
if [[ -e /usr/local/bin/pocketbase ]]; then
  echo "[entrypoint-env] notice: /usr/local/bin/pocketbase exists - the entrypoint would exec it; skipping the ENCRYPTION_KEY scenarios" >&2
  [[ "$FAIL" == 0 ]] && echo "PASS (partial): env contract holds." ; exit $(( FAIL > 0 ))
fi
: > "$TMP/manifests/migrations.txt"; : > "$TMP/manifests/hooks.txt"

run_entrypoint() { # $1 = ENCRYPTION_KEY value ("" = unset), $2 = log file
  local key="$1"
  rm -f "$TMP/args"
  env -u ENCRYPTION_KEY \
    ${key:+ENCRYPTION_KEY="$key"} \
    STUB_ARGS_FILE="$TMP/args" \
    PB_DATA_FILE="$TMP/pb_data/data.db" PB_DATA_DIR="$TMP/pb_data" \
    PB_MIGRATIONS_DIR="$TMP/migrations" PB_MIGRATIONS_BUNDLED_DIR="$TMP/migrations_bundled" \
    PB_HOOKS_DIR="$TMP/hooks" PB_HOOKS_BUNDLED_DIR="$TMP/hooks_bundled" \
    PB_MIGRATIONS_MANIFEST="$TMP/manifests/migrations.txt" PB_HOOKS_MANIFEST="$TMP/manifests/hooks.txt" \
    PATH="$TMP/bin:$PATH" \
    sh "$ROOT/pocketbase-entrypoint.sh" serve --http=0.0.0.0:8090 >"$2" 2>&1 || fail "entrypoint exited non-zero (key='${key}')"
}

run_entrypoint "" "$TMP/none.log"
grep -q -- '--encryptionEnv' "$TMP/args" && fail "no ENCRYPTION_KEY, but --encryptionEnv was passed"
ok "no key -> no --encryptionEnv"

run_entrypoint "0123456789abcdef0123456789abcdef" "$TMP/valid.log"
grep -qx -- '--encryptionEnv=ENCRYPTION_KEY' "$TMP/args" || fail "32-char key: --encryptionEnv=ENCRYPTION_KEY missing from: $(tr '\n' ' ' < "$TMP/args")"
grep -qx -- '--http=0.0.0.0:8090' "$TMP/args" || fail "32-char key: original serve arguments were lost"
grep -q 'encrypted at rest' "$TMP/valid.log" || fail "32-char key: no log line"
ok "32-char key -> --encryptionEnv=ENCRYPTION_KEY appended, original args kept"

run_entrypoint "too-short" "$TMP/short.log"
grep -q -- '--encryptionEnv' "$TMP/args" && fail "invalid key: --encryptionEnv must not be passed" || true
grep -q 'must be exactly 32 characters' "$TMP/short.log" || fail "invalid key: no warning"
ok "invalid key -> warning, no flag"

if [[ "$FAIL" != 0 ]]; then echo "FAIL: entrypoint env contract" >&2; exit 1; fi
echo "PASS: compose forwards every documented runtime variable, .env.example is clean, ENCRYPTION_KEY is wired safely."
