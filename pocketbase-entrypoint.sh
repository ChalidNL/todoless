#!/bin/sh
# GH#34: runtime paths are env-overridable (defaults = production image paths)
# so CI/local tests can drive this entrypoint against temp dirs; in the image
# and compose these are never set and the defaults below always apply.
PB_DATA_DIR="${PB_DATA_DIR:-/pb_data}"
PB_DATA_FILE="${PB_DATA_FILE:-/pb_data/data.db}"
PB_MIGRATIONS_DIR="${PB_MIGRATIONS_DIR:-/pb_migrations}"
PB_HOOKS_DIR="${PB_HOOKS_DIR:-/pb_hooks}"
PB_MIGRATIONS_BUNDLED_DIR="${PB_MIGRATIONS_BUNDLED_DIR:-/pb_migrations_bundled}"
PB_HOOKS_BUNDLED_DIR="${PB_HOOKS_BUNDLED_DIR:-/pb_hooks_bundled}"

# GH#35: append-only manifests of every file the app has EVER seeded into the
# pb_migrations/pb_hooks runtime volumes (repo: app-managed-migrations.txt /
# app-managed-hooks.txt; CI lint scripts/check-app-manifest.sh keeps them
# current and append-only). The entrypoint prunes listed files that are no
# longer bundled in this image (renamed/removed upstream, or a downgrade), so
# removed hooks stop running and removed migrations never re-apply. Files NOT
# in the manifests are user-added and are NEVER touched. Pruned files are
# preserved as '<name>.gh35-removed-<timestamp>' (see remove_stale below).
PB_MIGRATIONS_MANIFEST="${PB_MIGRATIONS_MANIFEST:-/app-managed-migrations.txt}"
PB_HOOKS_MANIFEST="${PB_HOOKS_MANIFEST:-/app-managed-hooks.txt}"

# GH#45: this image runs as a fixed non-root UID (1000), and the compose service
# drops ALL capabilities (no cap_add). The runtime volumes must therefore be
# writable by uid 1000. Installations that predate the non-root images have
# root-owned volumes — migrate them once on the host (see README -> Updating):
#
#   docker compose stop
#   sudo chown -R 1000:1000 <host>/pb_data <host>/pb_migrations <host>/pb_hooks
#   docker compose up -d
#
# Fail fast instead of starting PocketBase against unwritable volumes: without
# migrations/hooks/DB access the app would come up half-broken.
for dir in "$PB_DATA_DIR" "$PB_MIGRATIONS_DIR" "$PB_HOOKS_DIR"; do
  if [ ! -d "$dir" ] || [ ! -w "$dir" ] || [ ! -x "$dir" ]; then
    echo "[entrypoint] ERROR: $dir is not writable by uid $(id -u)." >&2
    echo "[entrypoint] Run the one-time host chown documented in README (Updating -> Non-root images)," >&2
    echo "[entrypoint] e.g.: sudo chown -R 1000:1000 <host-path>/pb_data <host-path>/pb_migrations <host-path>/pb_hooks" >&2
    exit 1
  fi
done

# Seed bundled PocketBase migrations/hooks into runtime volumes.
# Bundled files in the image are the source of truth for app-managed scripts.
# A failed copy aborts startup (returns 1) so the container never runs with a
# partially seeded hooks/migrations volume.

seed_dir() {
  src_dir="$1"
  dst_dir="$2"
  label="$3"

  mkdir -p "$dst_dir" || return 1
  if [ ! -d "$src_dir" ]; then
    return 0
  fi

  find "$src_dir" -type f | while read -r f; do
    rel=${f#"$src_dir"/}
    dst="$dst_dir/$rel"
    mkdir -p "$(dirname "$dst")"
    if [ ! -f "$dst" ]; then
      echo "[entrypoint] seeding $label: $rel"
      cp "$f" "$dst" || { echo "[entrypoint] ERROR: failed to seed $label: $rel" >&2; return 1; }
    elif ! cmp -s "$f" "$dst"; then
      echo "[entrypoint] updating $label: $rel"
      cp "$f" "$dst" || { echo "[entrypoint] ERROR: failed to update $label: $rel" >&2; return 1; }
    fi
  done || return 1
}

# GH#35: prune stale bundled files from a runtime volume. The manifests list
# every file the app has EVER seeded; any listed file that is no longer
# bundled in this image (renamed/removed upstream, or absent on downgrade) is
# taken OUT of the active set so stale hooks stop running and removed
# migrations never re-apply. The stale file is preserved (renamed to
# '<name>.gh35-removed-<timestamp>') instead of hard-deleted: a self-hoster
# may have customized an app-seeded file in place, and the preserved copy
# keeps that data while the suffix guarantees hook/migration loaders ignore
# it. Files NOT listed in the manifest are user-added and are NEVER touched.
# Missing manifest/bundled/runtime dir means dev/test overrides without
# manifests: log a warning and continue gracefully. Directories in the volume
# are never touched (the preserved copy stays in its original subdir).
remove_stale() {
  manifest="$1"
  src_dir="$2"
  dst_dir="$3"
  label="$4"

  if [ ! -f "$manifest" ] || [ ! -d "$src_dir" ] || [ ! -d "$dst_dir" ]; then
    echo "[entrypoint] WARNING: skipping stale-file pruning ($label: manifest or bundled/runtime dir missing)" >&2
    return 0
  fi

  count=0
  while IFS= read -r rel; do
    # Skip blank lines and comments.
    case "$rel" in
      ''|'#'*) continue ;;
    esac
    # Defensive guard: refuse absolute paths and path traversal.
    case "$rel" in
      /*|*..*)
        echo "[entrypoint] WARNING: skipping unsafe manifest entry '$rel'" >&2
        continue
        ;;
    esac
    if [ -e "$src_dir/$rel" ]; then
      continue  # still bundled; seed_dir handles it
    fi
    if [ -f "$dst_dir/$rel" ] || [ -L "$dst_dir/$rel" ]; then
      # Preserve instead of hard-delete (GH#35): the '.gh35-removed-<ts>'
      # suffix is not .js, so PocketBase hook/migration loaders ignore it.
      preserved="${rel}.gh35-removed-$(date +%s)"
      echo "[entrypoint] removing stale $label: $rel (preserved as $preserved)"
      mv -- "$dst_dir/$rel" "$dst_dir/$preserved" || {
        echo "[entrypoint] ERROR: failed to preserve stale $label: $rel" >&2
        return 1
      }
      count=$((count + 1))
    elif [ -e "$dst_dir/$rel" ]; then
      # A manifest entry should always be a file we seeded; a directory with a
      # colliding name is user data - never recurse into it. Skip + warn.
      echo "[entrypoint] WARNING: skipping '$rel': not a regular file (user directory?)" >&2
    fi
  done < "$manifest"

  if [ "$count" -gt 0 ]; then
    echo "[entrypoint] stale $label prune: $count file(s) pruned (preserved as .gh35-removed-*)"
  fi
}

seed_dir "$PB_MIGRATIONS_BUNDLED_DIR" "$PB_MIGRATIONS_DIR" migration || exit 1
seed_dir "$PB_HOOKS_BUNDLED_DIR" "$PB_HOOKS_DIR" hook || exit 1

# GH#35: prune stale bundled files AFTER seeding, BEFORE the GH#34 rename sync.
remove_stale "$PB_MIGRATIONS_MANIFEST" "$PB_MIGRATIONS_BUNDLED_DIR" "$PB_MIGRATIONS_DIR" "migration" || exit 1
remove_stale "$PB_HOOKS_MANIFEST" "$PB_HOOKS_BUNDLED_DIR" "$PB_HOOKS_DIR" "hook" || exit 1

# ── Migration-rename sync (GH#34) ──────────────────────────────────────────
# PocketBase records applied migrations by FILE NAME in its SQLite _migrations
# table (pb_data/data.db) and re-runs any pb_migrations/*.js whose name is not
# in that table. Migration files in this repo were renamed several times
# (git history: dadca38, ab7f24f, 7463450), so an existing install's
# _migrations table still holds the OLD names. Without the sync below, the NEW
# files would re-run on the next start after an image update — crashing
# (e.g. "Collection name must be unique") or silently re-applying.
#
# The sync renames the _migrations rows to the new names AND removes the stale
# files, BEFORE PocketBase starts. The NOT EXISTS guard makes chained renames
# safe (015_* -> 016..024) and never double-maps a row. Fresh installs have no
# _migrations table yet, so the sync is a no-op there and every file runs once.
#
# MIGRATION_RENAMES: append-only, newline-separated `old_name|current_name`
# pairs, kept in this exact order. `current_name` is the name shipped in the
# image; `old_name` is a historical name some installs may still have recorded.
MIGRATION_RENAMES="015_linked_entity_references.js|016_linked_entity_references.js
015_notes_enhancements.js|017_notes_enhancements.js
015_reminders.js|020_reminders.js
015_sprint_status.js|021_sprint_status.js
015_tasks_reminders_module.js|022_tasks_reminders_module.js
016_add_item_private_field.js|023_add_item_private_field.js
015_ai_settings.js|024_ai_settings.js
019_fix_security_p10.js|018_fix_security_p10.js
033_add_firstname_lastname.js|032_5_add_firstname_lastname.js
061_label_visibility.js|z061_label_visibility.js"

migrate_renames() {
  db="${PB_DATA_FILE:-/pb_data/data.db}"
  migs_dir="${PB_MIGRATIONS_DIR:-/pb_migrations}"

  # Fail fast: a broken image without sqlite3 must not start PB while the
  # _migrations table and the filesystem disagree. The image ships sqlite3.
  if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "[entrypoint] ERROR: sqlite3 not found; cannot sync renamed migrations (GH#34). Refusing to start PocketBase." >&2
    exit 1
  fi

  # Does the DB track applied migrations yet? Fresh installs have no
  # _migrations table; everything below is then a no-op.
  has_table="$(sqlite3 "$db" "SELECT 1 FROM sqlite_master WHERE type='table' AND name='_migrations' LIMIT 1;" 2>/dev/null || true)"

  applied=0
  # File names contain no whitespace, so splitting the newline-separated map
  # on IFS is safe; empty lines produce no tokens and are ignored.
  for pair in $(printf '%s\n' "$MIGRATION_RENAMES"); do
    [ -z "$pair" ] && continue
    old="${pair%%|*}"
    new="${pair##*|}"
    # Guard against malformed entries: without a '|' old==new, and removing
    # that name would delete a canonical file from the runtime volume.
    if [ -z "$new" ] || [ "$old" = "$new" ]; then
      echo "[entrypoint] WARNING: skipping malformed MIGRATION_RENAMES entry '$pair'" >&2
      continue
    fi
    if [ -f "$migs_dir/$old" ]; then
      echo "[entrypoint] removing stale migration file: $old"
      rm -f "$migs_dir/$old"
    fi
    if [ "$has_table" = "1" ]; then
      # Rename only if the new name is not already recorded, so chained
      # renames never double-map. A sqlite3 failure here is fatal: silently
      # continuing would let PocketBase start with a stale _migrations row and
      # re-run the renamed migration — the exact GH#34 crash we prevent.
      n="$(sqlite3 "$db" "UPDATE _migrations SET file='$new' WHERE file='$old' AND NOT EXISTS (SELECT 1 FROM _migrations WHERE file='$new'); SELECT changes();" 2>&1)"
      rc=$?
      if [ "$rc" -ne 0 ]; then
        echo "[entrypoint] ERROR: sqlite3 failed syncing renamed migration '$old' -> '$new' (rc=$rc): $n" >&2
        exit 1
      fi
      case "$n" in
        ''|*[!0-9]*) ;;
        *) applied=$((applied + n)) ;;
      esac
    fi
  done

  echo "[entrypoint] migration rename sync: $applied mappings applied"
}

migrate_renames

# The image ships PocketBase 0.40.4 (see Dockerfile.pocketbase); no legacy
# 0.35 sed patches are needed — main.pb.js already targets 0.40.x.
# The hooks use $app directly, onRecordEnrich, and c.requestInfo() properly.

# ── Logging (GH#56) ──────────────────────────────────────────────────────────
# LOG_LEVEL controls how much backend logging reaches the container's stdout/
# stderr (docker logs -> Loki/promtail/Dozzle/Portainer).
#   info (default)  -> request log lines + warn/error
#   warn|error      -> only warn/error lines (via the request-logger hook)
#   debug|trace     -> same as info PLUS PocketBase's own dev output (--dev:
#                      app logs + executed SQL statements) so debugging is easy
LOG_LEVEL="${LOG_LEVEL:-info}"
case "$LOG_LEVEL" in
  debug|trace)
    echo "[entrypoint] LOG_LEVEL=$LOG_LEVEL -> enabling --dev (PocketBase console logs + SQL)"
    set -- "$@" --dev
    ;;
  info|warn|error)
    echo "[entrypoint] LOG_LEVEL=$LOG_LEVEL (request logging via pb_hooks/04_request_logger.pb.js)"
    ;;
  *)
    echo "[entrypoint] WARNING: unknown LOG_LEVEL '$LOG_LEVEL' (expected debug|info|warn|error|trace); defaulting to info" >&2
    LOG_LEVEL=info
    ;;
esac
export LOG_LEVEL

# ── Superuser bootstrap (GH#50) ──────────────────────────────────────────
# A stock install never gets a PocketBase superuser: the web onboarding only
# creates an app admin, so the dashboard (/_) stays locked. When both
# POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD are set, create or
# update the superuser before serving (idempotent upsert, runs on every start).
# Leaving them empty keeps the manual path (docker compose exec ... superuser
# upsert) and adds no noise.
if [ -n "${POCKETBASE_ADMIN_EMAIL:-}" ] && [ -n "${POCKETBASE_ADMIN_PASSWORD:-}" ]; then
  echo "[entrypoint] upserting PocketBase superuser: ${POCKETBASE_ADMIN_EMAIL}"
  if /usr/local/bin/pocketbase superuser upsert "${POCKETBASE_ADMIN_EMAIL}" "${POCKETBASE_ADMIN_PASSWORD}" --dir="${PB_DATA_DIR}"; then
    echo "[entrypoint] superuser ready"
  else
    echo "[entrypoint] WARNING: superuser upsert failed - continuing anyway; check POCKETBASE_ADMIN_EMAIL/PASSWORD" >&2
  fi
elif [ -n "${POCKETBASE_ADMIN_EMAIL:-}" ] || [ -n "${POCKETBASE_ADMIN_PASSWORD:-}" ]; then
  echo "[entrypoint] WARNING: set BOTH POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD to bootstrap the superuser (only one is set)" >&2
fi

# Hand off to PocketBase. The image always ships the binary at the absolute
# path; when it is absent (dev/test runs with PB_* overrides and a stub
# pocketbase on PATH) fall back to a PATH lookup so the entrypoint stays
# fully testable without write access to /usr/local/bin.
if [ ! -x /usr/local/bin/pocketbase ]; then
  exec pocketbase "$@"
fi
exec /usr/local/bin/pocketbase "$@"
