#!/usr/bin/env bash
# =============================================================================
# Migration immutability lint (GH#34)
#
# PocketBase tracks applied migrations by FILE NAME in `_migrations`, so a
# renamed or deleted migration file re-runs (or misfires) on existing
# installs. Immutability rule: nobody may rename or delete a migration file
# without declaring the old name in pocketbase-entrypoint.sh's
# MIGRATION_RENAMES map ('old|new' pairs), which keeps existing installs in
# sync. Pure additions (A) are fine.
#
# Usage:
#   bash scripts/check-migration-immutability.sh            # vs origin/main
#   bash scripts/check-migration-immutability.sh <ref>      # vs any ref
#
# Exit 0: no renamed/removed migrations, or every one is declared.
# Exit 1: at least one renamed/removed migration is NOT declared.
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REF="${1:-origin/main}"

if ! git rev-parse --verify --quiet "$REF" >/dev/null 2>&1; then
  echo "[migration-immutability] notice: git ref '$REF' not found - skipping check."
  exit 0
fi

offenders=()

# R lines: renamed (second token = old path), D lines: deleted (first token).
# For both, the OLD name is the one an existing install may have applied, so
# it is the name that must be declared in the entrypoint's rename map. Git
# prefixes the paths with pb_migrations/, but MIGRATION_RENAMES keys are bare
# file names -- normalize before grepping.
while IFS=$'\t' read -r st oldpath _newpath; do
  case "$st" in
    R*|D) ;;
    *) continue ;;
  esac
  old_bare="${oldpath##*/}"
  if ! git show HEAD:pocketbase-entrypoint.sh 2>/dev/null | grep -qF "$old_bare|"; then
    echo "[migration-immutability] ERROR: '$oldpath' was renamed/removed but is NOT declared in" >&2
    echo "[migration-immutability] pocketbase-entrypoint.sh MIGRATION_RENAMES ('$old_bare|...') - GH#34" >&2
    offenders+=("$oldpath")
  else
    echo "[migration-immutability] OK: '$old_bare' declared in MIGRATION_RENAMES"
  fi
done < <(git diff -M --name-status "$REF"...HEAD -- pb_migrations/)

if [[ "${#offenders[@]}" -gt 0 ]]; then
  echo "[migration-immutability] FAIL - undeclared migration renames/removals:" >&2
  printf '  %s\n' "${offenders[@]}" >&2
  exit 1
fi

echo "[migration-immutability] OK: no undeclared migration renames/removals (GH#34)."
exit 0