#!/usr/bin/env bash
# GH#31 — fail if any file under pb_hooks/ is dead code.
#
# PocketBase only auto-loads root-level *.pb.js hook files. Anything else
# under pb_hooks/ (e.g. lib/* modules, the removed legacy routes/ and cron/
# dirs) is reachable ONLY if a *.pb.js hook require()s it via
# require(__hooks + '/<rel>') (single- or double-quoted). This script exits
# non-zero when it finds a file that is neither a *.pb.js hook nor referenced
# from one, and prints the offending relative paths.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
hooks_dir="$root/pb_hooks"

if [ ! -d "$hooks_dir" ]; then
  echo "ERROR: pb_hooks/ directory not found at $hooks_dir" >&2
  exit 1
fi

offenders=()
while IFS= read -r -d '' file; do
  rel="${file#"$hooks_dir"/}"
  if [[ "$rel" == *.pb.js ]]; then
    continue
  fi
  if ! grep -r -F -q "'/${rel}'" "$hooks_dir" --include='*.pb.js' 2>/dev/null \
     && ! grep -r -F -q "\"/${rel}\"" "$hooks_dir" --include='*.pb.js' 2>/dev/null; then
    offenders+=("$rel")
  fi
done < <(find "$hooks_dir" -type f -print0)

if [ "${#offenders[@]}" -gt 0 ]; then
  echo "ERROR: files under pb_hooks/ that are neither *.pb.js hooks nor require()d by one:" >&2
  for rel in "${offenders[@]}"; do
    echo "  $rel" >&2
  done
  echo "PocketBase only auto-loads root-level *.pb.js hooks; other pb_hooks files" >&2
  echo "must be loaded via require(__hooks + '/<rel>') from a *.pb.js file (GH#31)." >&2
  exit 1
fi

echo "OK: every non-hook file under pb_hooks/ is require()d by a *.pb.js hook."