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

exec /usr/local/bin/pocketbase "$@"
