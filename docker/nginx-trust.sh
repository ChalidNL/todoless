#!/bin/sh
# Generates the deployment-specific parts of the nginx config from the
# environment (runs from /docker-entrypoint.d before nginx starts). The
# container filesystem is read-only, so the result goes to the /tmp tmpfs;
# nginx.conf includes it from there.
#
#   TODOLESS_TRUSTED_PROXIES  addresses/CIDRs of reverse proxies whose client-IP
#                             header nginx may believe (space or comma
#                             separated). Default: none - every client header
#                             is ignored and the TCP peer is the client.
#   TODOLESS_REAL_IP_HEADER   header that carries the client IP from those
#                             proxies. Default: X-Forwarded-For
#                             (cloudflared: CF-Connecting-IP).
#   TODOLESS_DASHBOARD_ALLOW  addresses/CIDRs allowed to open the PocketBase
#                             dashboard (/_/). Default: loopback, 10/8,
#                             192.168/16, Tailscale 100.64/10 and IPv6 ULA.
#                             172.16/12 is deliberately not in the default:
#                             Docker gateways live there, so every host-side
#                             reverse proxy would look like a LAN client.
#
# Values are validated; an invalid entry stops the container instead of being
# written into the config.
set -eu

OUT_DIR="${TODOLESS_NGINX_DIR:-/tmp/todoless-nginx}"
DEFAULT_DASHBOARD_ALLOW="127.0.0.0/8 10.0.0.0/8 192.168.0.0/16 100.64.0.0/10 ::1 fc00::/7"

fail() {
  echo "todoless: $*" >&2
  exit 1
}

# Prints the entries of a space/comma separated list, one per line, after
# checking each is an IPv4/IPv6 address or CIDR.
addresses() {
  name="$1"
  value="$2"
  for entry in $(printf '%s' "$value" | tr ',' ' '); do
    case "$entry" in
      *[!0-9A-Fa-f:./]*|"") fail "$name: '$entry' is not an IP address or CIDR" ;;
    esac
    case "$entry" in
      */*/*) fail "$name: '$entry' is not an IP address or CIDR" ;;
    esac
    printf '%s\n' "$entry"
  done
}

mkdir -p "$OUT_DIR"

trusted="$(addresses TODOLESS_TRUSTED_PROXIES "${TODOLESS_TRUSTED_PROXIES:-}")"
header="${TODOLESS_REAL_IP_HEADER:-X-Forwarded-For}"
case "$header" in
  *[!A-Za-z0-9-]*|"") fail "TODOLESS_REAL_IP_HEADER: '$header' is not a header name" ;;
esac

realip="$OUT_DIR/realip.conf"
if [ -n "$trusted" ]; then
  {
    echo "# Generated from TODOLESS_TRUSTED_PROXIES / TODOLESS_REAL_IP_HEADER."
    printf '%s\n' "$trusted" | while read -r entry; do
      echo "set_real_ip_from $entry;"
    done
    echo "real_ip_header $header;"
    echo "real_ip_recursive on;"
  } > "$realip"
else
  rm -f "$realip"
fi

allow_value="${TODOLESS_DASHBOARD_ALLOW:-$DEFAULT_DASHBOARD_ALLOW}"
allow="$(addresses TODOLESS_DASHBOARD_ALLOW "$allow_value")"
{
  echo "# Generated from TODOLESS_DASHBOARD_ALLOW."
  printf '%s\n' "$allow" | while read -r entry; do
    [ -n "$entry" ] && echo "allow $entry;"
  done
} > "$OUT_DIR/dashboard-allow.conf"

echo "todoless: trusted proxies: ${trusted:-none}; dashboard allow-list: $(printf '%s' "$allow" | tr '\n' ' ')"
