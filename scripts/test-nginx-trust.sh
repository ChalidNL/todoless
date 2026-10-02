#!/usr/bin/env bash
# Runs the shipped nginx.conf + docker/nginx-trust.sh in the real nginx base
# image (read-only filesystem, tmpfs like docker-compose.yml) and checks who
# reaches the PocketBase dashboard and whose IP the rate limit uses:
#   - default: a Docker-range client (172.16/12) is refused
#   - TODOLESS_DASHBOARD_ALLOW admits it, but not when it sends proxy headers
#   - TODOLESS_TRUSTED_PROXIES: the forwarded client IP is judged (and logged)
#   - without trust, a forged X-Forwarded-For changes nothing
#   - an invalid value stops the container
# "Allowed" shows up as 502: the request passed the gate and nginx tried the
# (absent) PocketBase upstream.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="${NGINX_IMAGE:-$(sed -n 's/^FROM \(nginxinc\/nginx-unprivileged[^ ]*\).*/\1/p' "$ROOT/Dockerfile.frontend")}"
CURL_IMAGE="${CURL_IMAGE:-curlimages/curl:latest}"
NET="todoless-nginx-trust-$$"
SUBNET="172.30.99.0/24"
WEB_IP="172.30.99.2"
CLIENT_IP="172.30.99.10"
WEB="todoless-nginx-trust-web-$$"

FAIL=0
pass() { echo "[nginx-trust] ok: $*"; }
fail() { FAIL=$((FAIL + 1)); echo "[nginx-trust] FAIL: $*" >&2; }

cleanup() {
  docker rm -f "$WEB" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network create --subnet "$SUBNET" "$NET" >/dev/null

start_web() {
  docker rm -f "$WEB" >/dev/null 2>&1 || true
  docker run -d --name "$WEB" --network "$NET" --ip "$WEB_IP" \
    --read-only --tmpfs /var/cache/nginx --tmpfs /var/run --tmpfs /tmp \
    --add-host pocketbase:127.0.0.1 \
    -v "$ROOT/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
    -v "$ROOT/docker/nginx-trust.sh:/docker-entrypoint.d/15-todoless-trust.sh:ro" \
    "$@" "$IMAGE" >/dev/null
  for _ in $(seq 1 30); do
    if [ "$(docker inspect -f '{{.State.Running}}' "$WEB" 2>/dev/null)" != "true" ]; then
      return 1
    fi
    if request /healthz >/dev/null 2>&1; then return 0; fi
    sleep 0.5
  done
  return 1
}

# request <path> [curl args...] -> prints the HTTP status, sent from CLIENT_IP
request() {
  local path="$1"; shift
  docker run --rm --network "$NET" --ip "$CLIENT_IP" "$CURL_IMAGE" \
    -s -o /dev/null -w '%{http_code}' "$@" "http://$WEB_IP:8080$path"
}

expect() {
  local want="$1" label="$2"; shift 2
  local got
  got="$(request "$@")"
  if [ "$got" = "$want" ]; then pass "$label ($got)"; else fail "$label: expected $want, got $got"; fi
}

# ── defaults ────────────────────────────────────────────────────────────────
start_web || { docker logs "$WEB" >&2; fail "nginx did not start with the default env"; exit 1; }
docker exec "$WEB" nginx -t >/dev/null 2>&1 && pass "nginx -t with the default env" || fail "nginx -t with the default env"
expect 403 "default: Docker-range client cannot open the dashboard" /_/
expect 403 "default: forged X-Forwarded-For from a private address does not help" /_/ -H 'X-Forwarded-For: 192.168.1.5'
expect 200 "default: app shell still served" /

# Without trust, a forged X-Forwarded-For must not give each request its own
# rate-limit bucket: the strict auth zone (5r/m, burst 10) still trips.
codes=""
for i in $(seq 1 14); do
  codes="$codes $(request /api/collections/_superusers/auth-with-password -X POST -H "X-Forwarded-For: 203.0.113.$i")"
done
case "$codes" in
  *429*) pass "forged X-Forwarded-For does not escape the auth rate limit" ;;
  *) fail "auth rate limit never answered 429 with rotating X-Forwarded-For:$codes" ;;
esac
# (The header itself is logged in its own field at the end of the line.)
docker logs "$WEB" 2>&1 | grep -q '^203\.0\.113\.' && fail "an untrusted X-Forwarded-For address reached the access log as client IP" \
  || pass "untrusted X-Forwarded-For is not logged as client IP"

# ── explicit dashboard allow-list ───────────────────────────────────────────
start_web -e TODOLESS_DASHBOARD_ALLOW="$CLIENT_IP/32" || { docker logs "$WEB" >&2; fail "nginx did not start with an allow-list"; }
expect 502 "allow-list: listed client reaches the dashboard" /_/
expect 403 "allow-list: listed client with a proxy header is refused" /_/ -H 'X-Forwarded-For: 192.168.1.5'

# ── trusted proxy ───────────────────────────────────────────────────────────
start_web -e TODOLESS_TRUSTED_PROXIES="$CLIENT_IP" || { docker logs "$WEB" >&2; fail "nginx did not start with a trusted proxy"; }
expect 502 "trusted proxy: forwarded LAN client reaches the dashboard" /_/ -H 'X-Forwarded-For: 192.168.1.5'
expect 403 "trusted proxy: forwarded internet client is refused" /_/ -H 'X-Forwarded-For: 198.51.100.7'
expect 403 "trusted proxy: the proxy itself (172.16/12) is refused" /_/
expect 403 "trusted proxy: spoofed hop before an internet client is ignored" /_/ -H 'X-Forwarded-For: 192.168.1.5, 198.51.100.7'
docker logs "$WEB" 2>&1 | grep -q '^198\.51\.100\.7 ' && pass "trusted proxy: forwarded client IP is logged" \
  || fail "trusted proxy: forwarded client IP missing from the access log"

start_web -e TODOLESS_TRUSTED_PROXIES="$CLIENT_IP" -e TODOLESS_REAL_IP_HEADER=CF-Connecting-IP \
  || { docker logs "$WEB" >&2; fail "nginx did not start with CF-Connecting-IP"; }
expect 502 "CF-Connecting-IP: forwarded LAN client reaches the dashboard" /_/ -H 'CF-Connecting-IP: 192.168.1.5'
expect 403 "CF-Connecting-IP: X-Forwarded-For is not the configured header" /_/ -H 'X-Forwarded-For: 192.168.1.5'

# ── invalid values ──────────────────────────────────────────────────────────
if start_web -e 'TODOLESS_TRUSTED_PROXIES=10.0.0.1; allow all'; then
  fail "an invalid TODOLESS_TRUSTED_PROXIES was accepted"
else
  pass "invalid TODOLESS_TRUSTED_PROXIES stops the container"
fi
if start_web -e 'TODOLESS_REAL_IP_HEADER=X-Real-IP;'; then
  fail "an invalid TODOLESS_REAL_IP_HEADER was accepted"
else
  pass "invalid TODOLESS_REAL_IP_HEADER stops the container"
fi

if [ "$FAIL" -ne 0 ]; then
  echo "[nginx-trust] $FAIL check(s) failed" >&2
  exit 1
fi
echo "PASS: dashboard allow-list and trusted proxies behave as documented."
