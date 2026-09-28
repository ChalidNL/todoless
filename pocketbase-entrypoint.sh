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

# Remove duplicate migration prefixes that collide with newer files.
for old in 019_fix_security_p10.js 033_add_firstname_lastname.js; do
  if [ -f "/pb_migrations/$old" ]; then
    echo "[entrypoint] removing duplicate migration: $old"
    rm -f "/pb_migrations/$old"
  fi
done

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
