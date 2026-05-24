#!/bin/bash
# todoless-ngx Deployment Script
# Usage: ./scripts/deploy.sh <env> [--no-verify]
#   env: dev | main
#   --no-verify: skip post-deploy verification

set -euo pipefail

ENV="${1:-}"
NO_VERIFY="${2:-}"

if [ "$ENV" != "dev" ] && [ "$ENV" != "main" ]; then
  echo "Usage: ./scripts/deploy.sh <dev|main> [--no-verify]"
  exit 1
fi

COMPOSE_FILE="docker-compose.yml"
IMAGE_TAG="latest"
if [ "$ENV" = "dev" ]; then
  COMPOSE_FILE="docker-compose.dev.yml"
  IMAGE_TAG="dev"
fi

echo "🚀 Deploying to $ENV (tag: $IMAGE_TAG)"

# Step 1: Pull latest images
echo "📦 Pulling images..."
docker compose -f "$COMPOSE_FILE" pull

# Step 2: Restart services
echo "🔄 Restarting..."
docker compose -f "$COMPOSE_FILE" up -d --force-recreate

# Step 3: Wait for health
echo "⏳ Waiting for healthy..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:7070/api/health >/dev/null 2>&1; then
    echo "✅ Healthy after ${i}s"
    break
  fi
  sleep 1
done

# Step 4: Verify version
echo "🔍 Version check..."
curl -s http://localhost:7070/api/version | python3 -m json.tool 2>/dev/null || echo "⚠️  /api/version not available"

# Step 5: Open collection rules (first deploy or after hooks change)
echo "🔓 Opening collection rules..."
curl -s -X POST http://localhost:7070/api/open-rules >/dev/null 2>&1 && echo "   Rules open" || echo "   ⚠️  /api/open-rules not available (old hooks)"

if [ "$NO_VERIFY" != "--no-verify" ]; then
  # Step 6: Basic smoke test
  echo "🧪 Smoke test..."
  
  # Login test
  HTTP=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:7070/)
  if [ "$HTTP" = "200" ]; then
    echo "   Frontend: ✅ 200"
  else
    echo "   Frontend: ❌ $HTTP"
  fi

  # API health
  HEALTH=$(curl -s http://localhost:7070/api/health | python3 -c "import sys,json; print(json.load(sys.stdin).get('message',''))" 2>/dev/null)
  if [ -n "$HEALTH" ]; then
    echo "   API: ✅ $HEALTH"
  else
    echo "   API: ❌"
  fi

  # Hook health
  HOOK=$(curl -s http://localhost:7070/api/hook-health 2>/dev/null)
  if echo "$HOOK" | grep -q '"ok":true'; then
    echo "   Hooks: ✅ loaded"
  else
    echo "   Hooks: ❌"
  fi
fi

echo ""
echo "✅ Deploy to $ENV complete"
echo "   Image tag: $IMAGE_TAG"
echo "   Compose:   $COMPOSE_FILE"
