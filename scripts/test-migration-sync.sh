#!/usr/bin/env bash
# =============================================================================
# Migration rename sync regression test (GH#34)
#
# pocketbase-entrypoint.sh must reconcile renamed migration files BEFORE
# PocketBase starts: stale old-named files are removed from the runtime
# migrations dir and the `_migrations` tracking rows are renamed old -> new,
# so renamed migrations never re-run on existing installations. This script:
#
#   1. builds a sandbox: a data.db whose `_migrations` holds the 11 old file
#      names, a bundled dir with the canonical current-named files (copied
#      from the repo), and a runtime migrations dir that still carries the
#      11 stale old files (a pre-upgrade volume);
#   2. runs the REAL entrypoint (`sh $ENTRYPOINT serve`) against it with the
#      PB_* env overrides and a stub `pocketbase` on PATH;
#   3. asserts every old row and old file is gone and every canonical name is
#      present;
#   4. repeats against a fresh data.db WITHOUT `_migrations` to prove the sync
#      is a no-op on brand-new installs.
#
# Requires the sqlite3 CLI (CI runners provide it); skipped otherwise.
#
# Usage:
#   bash scripts/test-migration-sync.sh
#   PB_ENTRYPOINT=/path/to/pocketbase-entrypoint.sh bash scripts/test-migration-sync.sh
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENTRYPOINT="${PB_ENTRYPOINT:-$ROOT/pocketbase-entrypoint.sh}"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "SKIP: sqlite3 CLI not found - migration-sync test needs it (CI runners provide sqlite3)."
  exit 77
fi

TMP="$(mktemp -d /tmp/pb-sync.XXXXXX)"
STUB_SYSTEM=""
cleanup() {
  rm -rf "$TMP"
  if [[ -n "$STUB_SYSTEM" ]]; then
    rm -f /usr/local/bin/pocketbase
  fi
}
trap cleanup EXIT

mkdir -p "$TMP/pb_data" "$TMP/migrations_bundled" "$TMP/migrations" "$TMP/hooks" "$TMP/hooks_bundled" "$TMP/bin"

# The 11 old|current rename pairs the entrypoint must handle (GH#34).
RENAMES='015_linked_entity_references.js|016_linked_entity_references.js
015_notes_enhancements.js|017_notes_enhancements.js
015_paperless_sync.js|019_paperless_sync.js
015_reminders.js|020_reminders.js
015_sprint_status.js|021_sprint_status.js
015_tasks_reminders_module.js|022_tasks_reminders_module.js
016_add_item_private_field.js|023_add_item_private_field.js
015_ai_settings.js|024_ai_settings.js
019_fix_security_p10.js|018_fix_security_p10.js
033_add_firstname_lastname.js|032_5_add_firstname_lastname.js
061_label_visibility.js|z061_label_visibility.js'

# Canonical current-named files seeded from the image (bundled) dir.
CANONICAL='016_linked_entity_references.js
018_fix_security_p10.js
032_5_add_firstname_lastname.js
z061_label_visibility.js'

while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  cp "$ROOT/pb_migrations/$f" "$TMP/migrations_bundled/"
done <<< "$CANONICAL"

# Runtime migrations dir starts with the 11 stale OLD files (pre-upgrade volume).
olds=()
while IFS='|' read -r old _new; do
  [[ -z "$old" ]] && continue
  olds+=("$old")
  : > "$TMP/migrations/$old"
done <<< "$RENAMES"

# Existing install: _migrations tracks the 11 OLD names.
python3 - "$TMP/pb_data/data.db" "$RENAMES" <<'PY'
import sqlite3, sys
con = sqlite3.connect(sys.argv[1])
try:
    con.execute("CREATE TABLE _migrations (file TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))")
    olds = [line.split("|")[0] for line in sys.argv[2].strip().splitlines()]
    con.executemany("INSERT INTO _migrations (file) VALUES (?)", [(o,) for o in olds])
    con.commit()
    print(f"[migration-sync] seeded _migrations with {len(olds)} old-name rows")
finally:
    con.close()
PY

# Stub `pocketbase` that swallows the args and exits 0 (entrypoint execs it).
cat > "$TMP/bin/pocketbase" <<'EOF'
#!/bin/sh
exit 0
EOF
chmod +x "$TMP/bin/pocketbase"

# If the entrypoint execs the absolute /usr/local/bin/pocketbase, plant the
# stub there too (GH runners allow writing /usr/local/bin; never overwrite an
# existing binary, that is most likely a real installation).
if [[ ! -e /usr/local/bin/pocketbase ]]; then
  if cp "$TMP/bin/pocketbase" /usr/local/bin/pocketbase 2>/dev/null; then
    STUB_SYSTEM=1
    echo "[migration-sync] planted pocketbase stub at /usr/local/bin/pocketbase (removed on exit)"
  fi
elif grep -q '/usr/local/bin/pocketbase' "$ENTRYPOINT"; then
  echo "[migration-sync] ERROR: $ENTRYPOINT execs /usr/local/bin/pocketbase but that path already exists and is not ours." >&2
  echo "[migration-sync] Refusing to overwrite it. Remove it first, or point PB_ENTRYPOINT at a stub-respecting entrypoint." >&2
  exit 1
fi

# --- Scenario 1: existing install (stale rows + stale files) -----------------
set +e
env \
  PB_DATA_FILE="$TMP/pb_data/data.db" \
  PB_MIGRATIONS_DIR="$TMP/migrations" \
  PB_DATA_DIR="$TMP/pb_data" \
  PB_HOOKS_DIR="$TMP/hooks" \
  PB_MIGRATIONS_BUNDLED_DIR="$TMP/migrations_bundled" \
  PB_HOOKS_BUNDLED_DIR="$TMP/hooks_bundled" \
  PATH="$TMP/bin:$PATH" \
  sh "$ENTRYPOINT" serve >"$TMP/run1.log" 2>&1
RC=$?
set -e
if [[ "$RC" != "0" ]]; then
  echo "[migration-sync] ERROR: entrypoint exited $RC on an existing install (stale _migrations rows + files)" >&2
  echo "----- entrypoint output -----" >&2
  cat "$TMP/run1.log" >&2
  exit 1
fi
echo "[migration-sync] entrypoint sync on existing install completed (exit 0)."

# (b) _migrations rows: no old name remains, every canonical name is present.
python3 - "$TMP/pb_data/data.db" "$RENAMES" <<'PY'
import sqlite3, sys
con = sqlite3.connect(sys.argv[1])
try:
    pairs = [tuple(line.split("|")) for line in sys.argv[2].strip().splitlines()]
    rows = {r[0] for r in con.execute("SELECT file FROM _migrations")}
    problems = []
    for old, new in pairs:
        if old in rows:
            problems.append(f"old row still present: {old}")
        if new not in rows:
            problems.append(f"canonical row missing: {new}")
    print(f"[migration-sync] _migrations rows after sync: {len(rows)} (expect all {len(pairs)} canonical names)")
    if problems:
        for p in problems:
            print(f"[migration-sync] ERROR: {p}", file=sys.stderr)
        sys.exit(1)
finally:
    con.close()
PY

# (c) runtime dir: stale old files removed, canonical files present.
FILES_BAD=""
for old in "${olds[@]}"; do
  if [[ -e "$TMP/migrations/$old" ]]; then
    echo "[migration-sync] ERROR: stale file still present in runtime dir: $old" >&2
    FILES_BAD=1
  fi
done
while IFS= read -r new; do
  [[ -z "$new" ]] && continue
  if [[ ! -f "$TMP/migrations/$new" ]]; then
    echo "[migration-sync] ERROR: canonical file missing from runtime dir: $new" >&2
    FILES_BAD=1
  fi
done <<< "$CANONICAL"
if [[ -n "${FILES_BAD:-}" ]]; then
  exit 1
fi
echo "[migration-sync] runtime migrations dir: ${#olds[@]} stale files removed, canonical files present."

# --- Scenario 2: fresh install (no _migrations table yet) --------------------
mkdir -p "$TMP/pb_data2"
python3 -c "import sqlite3; sqlite3.connect('$TMP/pb_data2/data.db').close()"

set +e
env \
  PB_DATA_FILE="$TMP/pb_data2/data.db" \
  PB_MIGRATIONS_DIR="$TMP/migrations" \
  PB_DATA_DIR="$TMP/pb_data2" \
  PB_HOOKS_DIR="$TMP/hooks" \
  PB_MIGRATIONS_BUNDLED_DIR="$TMP/migrations_bundled" \
  PB_HOOKS_BUNDLED_DIR="$TMP/hooks_bundled" \
  PATH="$TMP/bin:$PATH" \
  sh "$ENTRYPOINT" serve >"$TMP/run2.log" 2>&1
RC2=$?
set -e
if [[ "$RC2" != "0" ]]; then
  echo "[migration-sync] ERROR: entrypoint exited $RC2 on a fresh install (no _migrations yet)" >&2
  echo "----- entrypoint output -----" >&2
  cat "$TMP/run2.log" >&2
  exit 1
fi
if grep -Ei 'sqlite' "$TMP/run2.log"; then
  echo "[migration-sync] ERROR: fresh-install sync logged an sqlite failure:" >&2
  cat "$TMP/run2.log" >&2
  exit 1
fi
echo "[migration-sync] fresh-install sync passed (no _migrations -> no-op, exit 0)."

echo "PASS: entrypoint migration rename sync handles existing and fresh installs (GH#34)."