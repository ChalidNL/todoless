#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="${GITLEAKS_CONFIG:-.gitleaks.toml}"
REPORT_PATH="${GITLEAKS_REPORT_PATH:-gitleaks-report.sarif}"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "[ERROR] Config not found: $CONFIG_FILE" >&2
  exit 1
fi

if command -v gitleaks >/dev/null 2>&1; then
  echo "[INFO] Running gitleaks binary scan"
  gitleaks git . --redact --config "$CONFIG_FILE" --report-format sarif --report-path "$REPORT_PATH"
  exit 0
fi

if command -v docker >/dev/null 2>&1; then
  echo "[INFO] gitleaks not installed; using docker image"
  if docker run --rm -v "$PWD:/repo" alpine sh -c "test -f '/repo/$CONFIG_FILE'" >/dev/null 2>&1; then
    docker run --rm \
      -v "$PWD:/repo" \
      zricethezav/gitleaks:v8.24.2 \
      git /repo --redact --config "/repo/$CONFIG_FILE" --report-format sarif --report-path "/repo/$REPORT_PATH"
    exit 0
  fi
  echo "[WARN] Docker bind mount did not expose repo files; falling back to temporary gitleaks binary" >&2
fi

if command -v curl >/dev/null 2>&1 && command -v tar >/dev/null 2>&1; then
  arch="$(uname -m)"
  case "$arch" in
    x86_64) asset_arch="x64" ;;
    aarch64|arm64) asset_arch="arm64" ;;
    *) echo "[ERROR] Unsupported architecture for gitleaks fallback: $arch" >&2; exit 1 ;;
  esac
  tmpdir="${TMPDIR:-/tmp}/todoless-gitleaks"
  mkdir -p "$tmpdir"
  if [[ ! -x "$tmpdir/gitleaks" ]]; then
    curl -fsSL -o "$tmpdir/gitleaks.tar.gz" "https://github.com/gitleaks/gitleaks/releases/download/v8.24.2/gitleaks_8.24.2_linux_${asset_arch}.tar.gz"
    tar -xzf "$tmpdir/gitleaks.tar.gz" -C "$tmpdir" gitleaks
  fi
  "$tmpdir/gitleaks" git . --redact --config "$CONFIG_FILE" --report-format sarif --report-path "$REPORT_PATH"
  exit 0
fi

echo "[ERROR] Neither gitleaks nor a usable docker/curl fallback is available." >&2
echo "Install gitleaks: https://github.com/gitleaks/gitleaks" >&2
exit 1
