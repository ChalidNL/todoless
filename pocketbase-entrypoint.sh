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
# seed_dir /pb_hooks_bundled /pb_hooks hook  # disabled — volume mount has latest

# Remove duplicate migration prefixes that collide with newer files.
for old in 019_fix_security_p10.js 033_add_firstname_lastname.js; do
  if [ -f "/pb_migrations/$old" ]; then
    echo "[entrypoint] removing duplicate migration: $old"
    rm -f "/pb_migrations/$old"
  fi
done

# HACK: PB 0.35 fixes for main.pb.js
if [ -f /pb_hooks/main.pb.js ]; then
  # 1. onRecordView is PB 0.34 syntax - use onRecordEnrich for PB 0.35
  sed -i 's/onRecordView/onRecordEnrich/g' /pb_hooks/main.pb.js

  # 2. $app.unsafeWithoutHooks() bypass breaks auth in PB 0.35 — use $app directly
  sed -i 's/\$app\.unsafeWithoutHooks()/$app/g' /pb_hooks/main.pb.js

  # 3. PB 0.35.1 bug: 3rd param in hook registrations causes ReferenceError on save
  sed -i "s/, 'users');/);/g" /pb_hooks/main.pb.js

  # 4. ID format: $security.randomString(15) generates mixed case, but PB 0.35
  # expects lowercase [a-z0-9]{15} for the id field pattern
  sed -i 's/\$security\.randomString(15)/\$security.randomString(15).toLowerCase()/g' /pb_hooks/main.pb.js
fi
# 5. PB 0.35.1: strip $apis.requireRecordAuth() — sed replaces python3
sed -i 's/,\s*\$apis\.requireRecordAuth([^)]*)/)/g' /pb_hooks/*.pb.js /pb_hooks/routes/*.js 2>/dev/null || true
sed -i '/\$apis\.requireRecordAuth/d' /pb_hooks/*.pb.js /pb_hooks/routes/*.js 2>/dev/null || true

exec /usr/local/bin/pocketbase "$@"
