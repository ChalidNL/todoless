#!/usr/bin/env bash
# =============================================================================
# App-managed manifests currency lint (GH#35)
#
# app-managed-migrations.txt / app-managed-hooks.txt are append-only manifests
# of every file the app has EVER seeded into the pb_migrations/pb_hooks
# runtime volumes. The entrypoint (pocketbase-entrypoint.sh -> remove_stale)
# prunes listed files that are no longer bundled, so a manifest that misses a
# current file, or that drops an old name, would leave stale hooks running /
# stale migrations re-applying. This lint enforces, for both dirs:
#
#   1. currency: every file currently under the dir (HEAD) is listed in the
#      manifest (exact relative path, no dir prefix);
#   2. format: no blank lines, no leading '/', no '..' in entries;
#   3. append-only (diff): every rename (R*) / delete (D) vs REF keeps the OLD
#      relative path in the manifest;
#   4. append-only (direct): every non-comment entry REF's manifest had is
#      still present in HEAD's manifest (no entry is ever removed).
#
# Usage:
#   bash scripts/check-app-manifest.sh            # vs origin/main
#   bash scripts/check-app-manifest.sh <ref>      # vs any ref
#
# Exit 0: manifests complete + append-only. Exit 1: offenders found.
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REF="${1:-origin/main}"

if ! git rev-parse --verify --quiet "$REF" >/dev/null 2>&1; then
  echo "[app-manifest] notice: git ref '$REF' not found - skipping check."
  exit 0
fi

offenders=()

check_manifest() {  # $1 = manifest file, $2 = dir
  local manifest="$1" dir="$2"
  local entries verbatim

  if [[ ! -f "$manifest" ]]; then
    offenders+=("$manifest: manifest file missing")
    return
  fi

  # Entries: non-blank, non-comment lines. Verbatim content for format checks.
  entries="$(awk '!/^[[:space:]]*#/ && NF {print}' "$manifest")"
  verbatim="$(cat "$manifest")"

  # 1. Currency: every current file under the dir must be listed.
  local f rel
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    rel="${f#"$dir"/}"
    if ! grep -qxF "$rel" <<<"$entries"; then
      offenders+=("$dir/$rel: current file is NOT listed in $manifest")
    fi
  done < <(git ls-tree -r --name-only HEAD -- "$dir")

  # 2. Format: no blank lines, no leading '/', no '..' in entries.
  local line
  while IFS= read -r line; do
    [[ "$line" == '#'* ]] && continue
    if [[ -z "$line" ]]; then
      offenders+=("$manifest: blank line in manifest")
    fi
    if [[ "$line" == /* ]]; then
      offenders+=("$manifest: absolute path entry '$line'")
    fi
    if [[ "$line" == *..* ]]; then
      offenders+=("$manifest: '..' in entry '$line'")
    fi
  done <<<"$verbatim"

  # 3. Append-only: R*/D changes vs REF must keep the OLD path in the manifest.
  local st oldpath _newpath old_rel
  while IFS=$'\t' read -r st oldpath _newpath; do
    case "$st" in
      R*|D) ;;
      *) continue ;;
    esac
    old_rel="${oldpath#"$dir"/}"
    if ! grep -qxF "$old_rel" <<<"$entries"; then
      offenders+=("$dir: '$oldpath' was renamed/removed vs $REF but its old name is NOT in $manifest (append-only)")
    fi
  done < <(git diff -M --name-status "$REF"...HEAD -- "$dir")

  # 4. Append-only (direct): every non-comment entry REF's manifest had must
  #    still be in HEAD's manifest. The diff check above only inspects the
  #    last-commit window on push (REF...HEAD == HEAD~1...HEAD), so an entry
  #    dropped two commits after its file was renamed/deleted would escape it;
  #    a plain drop with no file change would escape it too. The invariant is
  #    exactly 'no entry ever removed' - check it directly. Skipped when REF
  #    does not have the manifest file yet (first merge of this feature).
  if git cat-file -e "$REF:$manifest" 2>/dev/null; then
    local ref_entries dropped
    ref_entries="$(git show "$REF:$manifest" | awk '!/^[[:space:]]*#/ && NF {print}')"
    dropped="$(comm -23 \
      <(printf '%s\n' "$ref_entries" | LC_ALL=C sort -u) \
      <(printf '%s\n' "$entries" | LC_ALL=C sort -u))"
    if [[ -n "$dropped" ]]; then
      while IFS= read -r entry; do
        [[ -z "$entry" ]] && continue
        offenders+=("$manifest: entry '$entry' was dropped vs $REF (append-only)")
      done <<<"$dropped"
    fi
  fi
}

check_manifest app-managed-migrations.txt pb_migrations
check_manifest app-managed-hooks.txt pb_hooks

if [[ "${#offenders[@]}" -gt 0 ]]; then
  echo "[app-manifest] FAIL - manifest offenders:" >&2
  printf '  %s\n' "${offenders[@]}" >&2
  exit 1
fi

echo "[app-manifest] OK: app-managed manifests are current and append-only (GH#35)."
exit 0
