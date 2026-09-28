#!/usr/bin/env bash
# =============================================================================
# Stale bundled hook/migration pruning regression test (GH#35)
#
# pocketbase-entrypoint.sh must prune app-managed files that are listed in the
# append-only manifests (app-managed-migrations.txt / app-managed-hooks.txt)
# but are no longer bundled in the running image, WITHOUT ever touching files
# that are not in the manifests (user-added files). This script:
#
#   1. builds sandboxes: bundled dirs (what the image ships) + runtime volume
#      dirs (what an install has on disk) + temp manifests, per scenario;
#   2. runs the REAL entrypoint (`sh $ENTRYPOINT serve`) against each with the
#      PB_* env overrides, a stub `pocketbase` (and a stub `sqlite3`, because
#      the entrypoint's GH#34 rename sync requires the CLI; the stub makes this
#      test independent of host sqlite3) on PATH;
#   3. asserts the outcomes:
#        A. existing install with stale files -> stale app-managed files are
#           pruned (preserved as '<name>.gh35-removed-<ts>', content intact),
#           bundled files seeded/kept, user files kept, user dirs untouched;
#        B. missing manifests -> entrypoint still exits 0, logs a WARNING, and
#           deletes nothing;
#        C. downgrade -> files shipped by a newer image but absent from this
#           image's bundled set are pruned (preserved);
#        D. user-created DIRECTORY whose name collides with a stale manifest
#           entry -> skipped with a WARNING, directory + contents preserved.
#
# Requires bash only (no sqlite3 needed on the host).
#
# Usage:
#   bash scripts/test-stale-cleanup.sh
#   PB_ENTRYPOINT=/path/to/pocketbase-entrypoint.sh bash scripts/test-stale-cleanup.sh
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENTRYPOINT="${PB_ENTRYPOINT:-$ROOT/pocketbase-entrypoint.sh}"

TMP="$(mktemp -d /tmp/pb-stale.XXXXXX)"
cleanup() {
  rm -rf "$TMP"
}
trap cleanup EXIT

mkdir -p "$TMP/bin"

# Stub `pocketbase` (the entrypoint falls back to a PATH lookup when the image
# path /usr/local/bin/pocketbase is absent - see the exec block in
# pocketbase-entrypoint.sh - so this stub is enough; no host write access
# needed) and a stub `sqlite3` (the entrypoint's GH#34 rename sync calls it;
# the stub answers nothing, which makes the sync a no-op - exactly what
# fresh/no-table installs see).
cat > "$TMP/bin/sqlite3" <<'EOF'
#!/bin/sh
exit 0
EOF
chmod +x "$TMP/bin/sqlite3"

# Safety: if a REAL /usr/local/bin/pocketbase exists, the entrypoint would exec
# it (preferring the image path) and actually start a server instead of the
# stub. Refuse to run against a real installation. A leftover stub from a
# previously aborted run (marked below) is removed and re-planted on PATH.
if [[ -e /usr/local/bin/pocketbase ]]; then
  if [[ "$(< /usr/local/bin/pocketbase)" == *"GH35-STALE-CLEANUP-STUB"* ]]; then
    rm -f /usr/local/bin/pocketbase
  else
    echo "[stale-cleanup] ERROR: /usr/local/bin/pocketbase exists and is not our stub - refusing to test against a real installation." >&2
    exit 1
  fi
fi
printf '#!/bin/sh\n# GH35-STALE-CLEANUP-STUB\nexit 0\n' > "$TMP/bin/pocketbase"
chmod +x "$TMP/bin/pocketbase"

FAIL=0
note_fail() {
  FAIL=1
  echo "[stale-cleanup] FAIL: $*" >&2
}
dump_log() {
  echo "----- entrypoint output -----" >&2
  cat "$1" >&2
}

# =============================================================================
# Scenario A: existing install with stale files
# =============================================================================
A="$TMP/a"
mkdir -p "$A/pb_data" "$A/migrations_bundled" "$A/migrations/sub" "$A/hooks_bundled/cron" "$A/hooks" "$A/manifests"

# Bundled (image) migrations: seed source + command source.
printf 'BUNDLED 001 content v2\n' > "$A/migrations_bundled/001_initial_schema.js"
printf 'BUNDLED 016 content\n' > "$A/migrations_bundled/016_linked_entity_references.js"
# Runtime migrations volume: an outdated copy (expect update), two stale app
# files (expect removal incl. empty subdir), and a user file (expect untouched).
printf 'OLD 001 content v1\n' > "$A/migrations/001_initial_schema.js"
printf 'STALE 020\n' > "$A/migrations/020_reminders.js"
printf 'STALE sub\n' > "$A/migrations/sub/old_thing.js"
printf 'USER KEEP MIGRATION\n' > "$A/migrations/user_keep.js"

# Bundled (image) hooks.
printf 'BUNDLED RATE LIMITER\n' > "$A/hooks_bundled/00_rate_limiter.js"
printf 'BUNDLED CRON\n' > "$A/hooks_bundled/cron/recurring-tasks.js"
# Runtime hooks volume: a bundled file (expect kept), a stale app file (expect
# removal), and a user file (expect untouched). cron/ gets seeded from bundled.
printf 'BUNDLED RATE LIMITER\n' > "$A/hooks/00_rate_limiter.js"
printf 'STALE HOOK\n' > "$A/hooks/old_hook.pb.js"
printf 'USER KEEP HOOK\n' > "$A/hooks/user_hook.pb.js"

# Temp manifests: app-managed ever-shipped file lists (with a comment line).
printf '# comment line\n001_initial_schema.js\n016_linked_entity_references.js\n020_reminders.js\nsub/old_thing.js\n' > "$A/manifests/migrations.txt"
printf '00_rate_limiter.js\ncron/recurring-tasks.js\nold_hook.pb.js\n' > "$A/manifests/hooks.txt"

set +e
env \
  PB_DATA_FILE="$A/pb_data/data.db" \
  PB_DATA_DIR="$A/pb_data" \
  PB_MIGRATIONS_DIR="$A/migrations" \
  PB_MIGRATIONS_BUNDLED_DIR="$A/migrations_bundled" \
  PB_HOOKS_DIR="$A/hooks" \
  PB_HOOKS_BUNDLED_DIR="$A/hooks_bundled" \
  PB_MIGRATIONS_MANIFEST="$A/manifests/migrations.txt" \
  PB_HOOKS_MANIFEST="$A/manifests/hooks.txt" \
  PATH="$TMP/bin:$PATH" \
  sh "$ENTRYPOINT" serve >"$A/run.log" 2>&1
RC=$?
set -e
if [[ "$RC" != "0" ]]; then
  note_fail "scenario A: entrypoint exited $RC (expected 0)"
  dump_log "$A/run.log"
else
  echo "[stale-cleanup] scenario A: entrypoint exited 0"
fi

# Assertions for scenario A.
[[ "$(<"$A/migrations/001_initial_schema.js")" == "BUNDLED 001 content v2" ]] \
  || note_fail "scenario A: 001_initial_schema.js was not updated to bundled content"
[[ ! -e "$A/migrations/020_reminders.js" ]] \
  || note_fail "scenario A: stale 020_reminders.js still present"
A_PRESERVED_020="$(ls "$A"/migrations/020_reminders.js.gh35-removed-* 2>/dev/null | head -1)"
[[ -n "$A_PRESERVED_020" && "$(<"$A_PRESERVED_020")" == "STALE 020" ]] \
  || note_fail "scenario A: stale 020_reminders.js content was not preserved as .gh35-removed-*"
[[ ! -e "$A/migrations/sub/old_thing.js" ]] \
  || note_fail "scenario A: stale sub/old_thing.js still present"
A_PRESERVED_SUB="$(ls "$A"/migrations/sub/old_thing.js.gh35-removed-* 2>/dev/null | head -1)"
[[ -n "$A_PRESERVED_SUB" && "$(<"$A_PRESERVED_SUB")" == "STALE sub" ]] \
  || note_fail "scenario A: stale sub/old_thing.js content was not preserved as .gh35-removed-*"
[[ -d "$A/migrations/sub" ]] \
  || note_fail "scenario A: sub/ dir was removed (preserved copy must stay in its subdir)"
[[ -f "$A/migrations/user_keep.js" && "$(<"$A/migrations/user_keep.js")" == "USER KEEP MIGRATION" ]] \
  || note_fail "scenario A: user file user_keep.js missing or modified"
[[ -f "$A/hooks/00_rate_limiter.js" ]] \
  || note_fail "scenario A: bundled 00_rate_limiter.js missing from hooks volume"
[[ ! -e "$A/hooks/old_hook.pb.js" ]] \
  || note_fail "scenario A: stale old_hook.pb.js still present"
A_PRESERVED_HOOK="$(ls "$A"/hooks/old_hook.pb.js.gh35-removed-* 2>/dev/null | head -1)"
[[ -n "$A_PRESERVED_HOOK" && "$(<"$A_PRESERVED_HOOK")" == "STALE HOOK" ]] \
  || note_fail "scenario A: stale old_hook.pb.js content was not preserved as .gh35-removed-*"
[[ -f "$A/hooks/cron/recurring-tasks.js" ]] \
  || note_fail "scenario A: cron/recurring-tasks.js was not seeded into hooks volume"
[[ -f "$A/hooks/user_hook.pb.js" && "$(<"$A/hooks/user_hook.pb.js")" == "USER KEEP HOOK" ]] \
  || note_fail "scenario A: user hook user_hook.pb.js missing or modified"
grep -qF "removing stale migration: 020_reminders.js" "$A/run.log" \
  || note_fail "scenario A: log missing 'removing stale migration: 020_reminders.js'"
grep -qF "removing stale hook: old_hook.pb.js" "$A/run.log" \
  || note_fail "scenario A: log missing 'removing stale hook: old_hook.pb.js'"
if [[ "$FAIL" == "1" ]]; then dump_log "$A/run.log"; fi

# =============================================================================
# Scenario B: manifests missing -> graceful skip, nothing deleted
# =============================================================================
B="$TMP/b"
mkdir -p "$B/pb_data" "$B/migrations_bundled" "$B/migrations" "$B/hooks_bundled" "$B/hooks"

printf 'BUNDLED 001 content\n' > "$B/migrations_bundled/001_initial_schema.js"
printf 'STALE 020\n' > "$B/migrations/020_reminders.js"   # stale-looking, manifest missing -> must stay

set +e
env \
  PB_DATA_FILE="$B/pb_data/data.db" \
  PB_DATA_DIR="$B/pb_data" \
  PB_MIGRATIONS_DIR="$B/migrations" \
  PB_MIGRATIONS_BUNDLED_DIR="$B/migrations_bundled" \
  PB_HOOKS_DIR="$B/hooks" \
  PB_HOOKS_BUNDLED_DIR="$B/hooks_bundled" \
  PB_MIGRATIONS_MANIFEST="$B/nonexistent-migrations.txt" \
  PB_HOOKS_MANIFEST="$B/nonexistent-hooks.txt" \
  PATH="$TMP/bin:$PATH" \
  sh "$ENTRYPOINT" serve >"$B/run.log" 2>&1
RC=$?
set -e
if [[ "$RC" != "0" ]]; then
  note_fail "scenario B: entrypoint exited $RC (expected 0 for missing manifests)"
  dump_log "$B/run.log"
else
  echo "[stale-cleanup] scenario B: entrypoint exited 0 with missing manifests"
fi
grep -qF "skipping stale-file pruning" "$B/run.log" \
  || note_fail "scenario B: log missing 'skipping stale-file pruning'"
[[ -f "$B/migrations/020_reminders.js" ]] \
  || note_fail "scenario B: 020_reminders.js was deleted despite missing manifests"
if [[ "$FAIL" == "1" ]]; then dump_log "$B/run.log"; fi

# =============================================================================
# Scenario C: downgrade - newer image's files absent from bundled set get pruned
# =============================================================================
C="$TMP/c"
mkdir -p "$C/pb_data" "$C/migrations_bundled" "$C/migrations" "$C/hooks_bundled" "$C/hooks" "$C/manifests"

printf 'BUNDLED 001 content\n' > "$C/migrations_bundled/001_initial_schema.js"
printf 'FROM NEWER IMAGE\n' > "$C/migrations/016_linked_entity_references.js"
printf '# comment\n001_initial_schema.js\n016_linked_entity_references.js\n' > "$C/manifests/migrations.txt"

set +e
env \
  PB_DATA_FILE="$C/pb_data/data.db" \
  PB_DATA_DIR="$C/pb_data" \
  PB_MIGRATIONS_DIR="$C/migrations" \
  PB_MIGRATIONS_BUNDLED_DIR="$C/migrations_bundled" \
  PB_HOOKS_DIR="$C/hooks" \
  PB_HOOKS_BUNDLED_DIR="$C/hooks_bundled" \
  PB_MIGRATIONS_MANIFEST="$C/manifests/migrations.txt" \
  PB_HOOKS_MANIFEST="$C/nonexistent-hooks.txt" \
  PATH="$TMP/bin:$PATH" \
  sh "$ENTRYPOINT" serve >"$C/run.log" 2>&1
RC=$?
set -e
if [[ "$RC" != "0" ]]; then
  note_fail "scenario C: entrypoint exited $RC (expected 0)"
  dump_log "$C/run.log"
else
  echo "[stale-cleanup] scenario C: entrypoint exited 0 (downgrade)"
fi
[[ ! -e "$C/migrations/016_linked_entity_references.js" ]] \
  || note_fail "scenario C: 016_linked_entity_references.js (from newer image) was not pruned on downgrade"
C_PRESERVED="$(ls "$C"/migrations/016_linked_entity_references.js.gh35-removed-* 2>/dev/null | head -1)"
[[ -n "$C_PRESERVED" && "$(<"$C_PRESERVED")" == "FROM NEWER IMAGE" ]] \
  || note_fail "scenario C: downgrade-pruned file content was not preserved as .gh35-removed-*"
grep -qF "removing stale migration: 016_linked_entity_references.js" "$C/run.log" \
  || note_fail "scenario C: log missing 'removing stale migration: 016_linked_entity_references.js'"
if [[ "$FAIL" == "1" ]]; then dump_log "$C/run.log"; fi

# =============================================================================
# Scenario D: user-created DIRECTORY collides with a stale manifest entry ->
# skipped with a WARNING; directory + contents preserved (never recursed).
# =============================================================================
D="$TMP/d"
mkdir -p "$D/pb_data" "$D/migrations_bundled" "$D/migrations/collision.js" "$D/hooks_bundled" "$D/hooks" "$D/manifests"

printf 'USER FILE INSIDE COLLIDING DIR\n' > "$D/migrations/collision.js/important.txt"
printf 'collision.js\n' > "$D/manifests/migrations.txt"

set +e
env \
  PB_DATA_FILE="$D/pb_data/data.db" \
  PB_DATA_DIR="$D/pb_data" \
  PB_MIGRATIONS_DIR="$D/migrations" \
  PB_MIGRATIONS_BUNDLED_DIR="$D/migrations_bundled" \
  PB_HOOKS_DIR="$D/hooks" \
  PB_HOOKS_BUNDLED_DIR="$D/hooks_bundled" \
  PB_MIGRATIONS_MANIFEST="$D/manifests/migrations.txt" \
  PB_HOOKS_MANIFEST="$D/nonexistent-hooks.txt" \
  PATH="$TMP/bin:$PATH" \
  sh "$ENTRYPOINT" serve >"$D/run.log" 2>&1
RC=$?
set -e
if [[ "$RC" != "0" ]]; then
  note_fail "scenario D: entrypoint exited $RC (expected 0)"
  dump_log "$D/run.log"
else
  echo "[stale-cleanup] scenario D: entrypoint exited 0 (user dir collision skipped)"
fi
[[ -f "$D/migrations/collision.js/important.txt" && "$(<"$D/migrations/collision.js/important.txt")" == "USER FILE INSIDE COLLIDING DIR" ]] \
  || note_fail "scenario D: user directory contents were modified/deleted"
grep -qF "skipping 'collision.js': not a regular file" "$D/run.log" \
  || note_fail "scenario D: log missing the not-a-regular-file WARNING"
if [[ "$FAIL" == "1" ]]; then dump_log "$D/run.log"; fi

if [[ "$FAIL" == "1" ]]; then
  echo "[stale-cleanup] FAILED (see above)." >&2
  exit 1
fi

echo "PASS: stale bundled hook/migration pruning handles existing installs, missing manifests and downgrades (GH#35)."
