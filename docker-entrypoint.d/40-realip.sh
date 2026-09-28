#!/bin/sh
# GH#41 - render optional realip config so rate limiting can key on the real
# client IP when todoless runs behind a reverse proxy.
#
# Default (TRUSTED_PROXY_CIDRS unset): no forwarded header is ever trusted;
# the rate-limit key stays the real socket peer address, which cannot be
# spoofed. This is the secure behavior for direct/LAN/Tailscale deployments.
#
# When set, nginx's realip module rewrites $remote_addr/$binary_remote_addr
# ONLY for connections whose immediate TCP peer is inside one of the trusted
# CIDRs. A direct caller (not via the proxy) can therefore never forge a
# forwarded client-IP header to dodge the rate limit.
#
# The rendered file always exists (comment-only when disabled); nginx.conf
# includes /var/run/nginx-realip.d/*.conf as a glob so a bare `nginx -t`
# without this entrypoint also succeeds.
set -eu

OUT_DIR="${OUT_DIR:-/var/run/nginx-realip.d}"
OUT_FILE="${OUT_FILE:-$OUT_DIR/realip.conf}"

mkdir -p "$OUT_DIR"

CIDRS="${TRUSTED_PROXY_CIDRS:-}"
HEADER="${REAL_IP_HEADER:-X-Forwarded-For}"

fail() {
  echo "ERROR: 40-realip.sh: $1" >&2
  exit 1
}

if [ -z "$CIDRS" ]; then
  cat > "$OUT_FILE" <<'EOF'
# GH#41: TRUSTED_PROXY_CIDRS is unset - no trusted reverse proxy configured.
# Rate-limit keys use the real socket peer address; forwarded client-IP
# headers are never trusted. See README "Real client IPs behind a reverse
# proxy (GH#41)".
EOF
  exit 0
fi

# Accept space- or comma-separated CIDR lists.
CIDRS="$(printf '%s' "$CIDRS" | tr ',' ' ')"

# Validate the header name: must be a plain HTTP header name (letters, digits,
# hyphen, underscore) with no whitespace or config-breaking characters.
case "$HEADER" in
  ''|*[!A-Za-z0-9_-]*)
    fail "REAL_IP_HEADER contains invalid characters: '$HEADER' (expected e.g. X-Forwarded-For or CF-Connecting-IP)"
    ;;
esac

{
  echo "# GH#41: real client IP from trusted reverse proxy (env-rendered)."
  echo "# TRUSTED_PROXY_CIDRS=${CIDRS} REAL_IP_HEADER=${HEADER}"
  for cidr in $CIDRS; do
    [ -n "$cidr" ] || continue
    # Must look like an IP or CIDR (IPv4/IPv6 with optional /prefix). Reject
    # anything that could break nginx config parsing (semicolons, braces...).
    case "$cidr" in
      *[!0-9A-Fa-f.:/]*)
        fail "TRUSTED_PROXY_CIDRS contains an invalid CIDR: '$cidr'"
        ;;
    esac
    echo "set_real_ip_from ${cidr};"
  done
  echo "real_ip_header ${HEADER};"
  echo "real_ip_recursive off;"
} > "$OUT_FILE"