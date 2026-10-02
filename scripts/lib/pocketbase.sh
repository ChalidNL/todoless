# Sourced by the scripts that run a real PocketBase.
#
#   source "$(dirname "${BASH_SOURCE[0]}")/lib/pocketbase.sh"
#   PB="$(pocketbase_bin "$SOME_TEMP_DIR")"
#
# PB_VERSION defaults to the version the production image is built on, so
# the tests always run against what ships. PB_BIN skips the download.

PB_VERSION="${PB_VERSION:-$(sed -n 's/^ARG PB_VERSION=//p' "$(dirname "${BASH_SOURCE[0]}")/../../Dockerfile.pocketbase")}"

# Prints the path of a PocketBase binary: $PB_BIN, or the release for this
# OS/architecture downloaded into <dir> (once).
pocketbase_bin() {
  if [[ -n "${PB_BIN:-}" ]]; then
    echo "$PB_BIN"
    return
  fi
  local dir="$1" os arch
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  case "$(uname -m)" in
    x86_64 | amd64) arch=amd64 ;;
    aarch64 | arm64) arch=arm64 ;;
    *) echo "unsupported architecture: $(uname -m)" >&2; return 1 ;;
  esac
  if [[ ! -x "$dir/pocketbase" ]]; then
    mkdir -p "$dir"
    echo "downloading PocketBase ${PB_VERSION} (${os}/${arch}) ..." >&2
    curl -fsSL "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${os}_${arch}.zip" -o "$dir/pb.zip"
    python3 -m zipfile -e "$dir/pb.zip" "$dir" >/dev/null
    chmod +x "$dir/pocketbase"
  fi
  echo "$dir/pocketbase"
}
