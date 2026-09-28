#!/bin/sh
# Seed bundled PocketBase migrations/hooks into runtime volumes.
# Bundled files in the image are the source of truth for app-managed scripts.

seed_dir() {
  src_dir="$1"
  dst_dir="$2"
  label="$3"

  mkdir -p "$dst_dir"
  if [ ! -d "$src_dir" ]; then
    return 0
  fi

  find "$src_dir" -type f | while read -r f; do
    rel=${f#"$src_dir"/}
    dst="$dst_dir/$rel"
    mkdir -p "$(dirname "$dst")"
    if [ ! -f "$dst" ]; then
      echo "[entrypoint] seeding $label: $rel"
      cp "$f" "$dst"
    elif ! cmp -s "$f" "$dst"; then
      echo "[entrypoint] updating $label: $rel"
      cp "$f" "$dst"
    fi
  done
}

seed_dir /pb_migrations_bundled /pb_migrations migration
seed_dir /pb_hooks_bundled /pb_hooks hook

# ── Migration rename sync (GH#38) ─────────────────────────────────────────────
# PocketBase tracks applied migrations by FILE NAME in the `_migrations` table
# (see GH#34: renamed migration files re-run on existing installations). To
# normalise migration numbering without re-running anything on installed
# instances, this block, running before PocketBase starts:
#   1. removes stale old-named files from the runtime migrations dir, and
#   2. renames the `_migrations` tracking rows so the new file names are seen
#      as already applied.
# Entries are `old_name|current_name` (append-only — never delete a shipped
# row, an existing install may still carry that old name).
MIGRATION_RENAMES='019_fix_security_p10.js|018_fix_security_p10.js
033_add_firstname_lastname.js|032_add_firstname_lastname.js
032_5_add_firstname_lastname.js|032_add_firstname_lastname.js
032_agent_audit_log.js|033_agent_audit_log.js
033_api_tokens.js|034_api_tokens.js
034_agent_approval.js|035_agent_approval.js
035_briefings.js|036_briefings.js
039_repeat_interval_options.js|040_repeat_interval_options.js
040_identity_model.js|041_identity_model.js
041_add_priority_values.js|042_add_priority_values.js
042_set_priority_values.js|043_set_priority_values.js
049_family_scope_users.js|050_family_scope_users.js
050_companion_notifications.js|051_companion_notifications.js
050_enforce_single_family_admin.js|052_enforce_single_family_admin.js
051_lock_direct_user_registration.js|053_lock_direct_user_registration.js
052_lock_agent_audit_log_rules.js|054_lock_agent_audit_log_rules.js
053_lock_direct_user_create_rule.js|055_lock_direct_user_create_rule.js
054_family_shop_write_rules.js|056_family_shop_write_rules.js
055_user_language_preference.js|057_user_language_preference.js
056_calendar_rfc5545_events.js|058_calendar_rfc5545_events.js
057_add_task_calendar_fields.js|059_add_task_calendar_fields.js
058_add_task_ics_fields.js|060_add_task_ics_fields.js
059_allow_de_es_user_languages.js|061_allow_de_es_user_languages.js
060_backfill_user_token_keys.js|062_backfill_user_token_keys.js
z061_label_visibility.js|063_label_visibility.js
z062_enforce_label_privacy.js|064_enforce_label_privacy.js
z063_fix_shared_label_rules.js|065_fix_shared_label_rules.js
z064_fix_agent_key_revocation.js|066_fix_agent_key_revocation.js
z065_fix_empty_task_label_rules.js|067_fix_empty_task_label_rules.js
z066_family_shared_task_write_rules.js|068_family_shared_task_write_rules.js
z066_normalize_invite_codes.js|069_normalize_invite_codes.js
z067_enable_scheduled_backups.js|070_enable_scheduled_backups.js'

migrate_renames() {
  db="${PB_DATA_FILE:-/pb_data/data.db}"
  migs_dir="${PB_MIGRATIONS_DIR:-/pb_migrations}"

  # The sync is what keeps renamed migrations from re-running on existing
  # installs; without sqlite3 a broken image would fail only later, deep inside
  # PocketBase. Fail fast instead.
  if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "[entrypoint] ERROR: sqlite3 not found — cannot apply migration rename sync (GH#38)" >&2
    exit 1
  fi

  # Fresh installs have no _migrations table yet — nothing to map, and PB will
  # happily apply every bundled migration for the first time.
  has_table="$(sqlite3 "$db" "SELECT 1 FROM sqlite_master WHERE type='table' AND name='_migrations' LIMIT 1;" 2>/dev/null || true)"

  printf '%s\n' "$MIGRATION_RENAMES" | while IFS='|' read -r old new; do
    [ -z "$old" ] && continue

    if [ -f "$migs_dir/$old" ]; then
      echo "[entrypoint] removing stale migration file: $old"
      rm -f "$migs_dir/$old"
    fi

    if [ "$has_table" = "1" ]; then
      # A current-name row may already exist (chained renames); never double-map.
      sqlite3 "$db" "UPDATE _migrations SET file='$new' WHERE file='$old' AND NOT EXISTS (SELECT 1 FROM _migrations WHERE file='$new');" >/dev/null 2>&1 || true
    fi
  done
}

migrate_renames

# PB 0.35 compat: No sed patches needed — main.pb.js is already 0.35-compatible.
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

exec /usr/local/bin/pocketbase "$@"
