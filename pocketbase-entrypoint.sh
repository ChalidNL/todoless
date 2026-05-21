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
# Bundled image has 019_fix_security_p10.js + 033_add_firstname_lastname.js
# which conflict with 019_paperless_sync.js and 033_api_tokens.js.
# Runtime has renamed versions (018, 032_5) — remove the old duplicates.
for old in 019_fix_security_p10.js 033_add_firstname_lastname.js; do
  if [ -f "/pb_migrations/$old" ]; then
    echo "[entrypoint] removing duplicate migration: $old"
    rm -f "/pb_migrations/$old"
  fi
done

# HACK: ensure main.pb.js uses PB 0.35 compatible API (onRecordEnrich)
# The bundled image may be outdated — fix after seed
if [ -f /pb_hooks/main.pb.js ]; then
  sed -i 's/onRecordView/onRecordEnrich/g' /pb_hooks/main.pb.js
fi

exec /usr/local/bin/pocketbase "$@"
