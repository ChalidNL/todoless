#!/bin/bash
# Regression test suite — P0 collaboration validation
# Usage: ./test-collaboration.sh <host> <user1_token> <user2_token>
# Example: ./test-collaboration.sh 192.168.2.100:7070 "token1" "token2"

HOST="${1:-localhost:7070}"
TOKEN1="${2:-}"
TOKEN2="${3:-}"
PASS=0
FAIL=0

ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $1 — $2"; FAIL=$((FAIL+1)); }
check() { if [ "$1" = "$2" ]; then ok "$3"; else fail "$3" "expected $2, got $1"; fi; }

echo "═══ P0 Collaboration Regression Suite ═══"
echo "Host: $HOST"
echo ""

# ─── 1. UI CREATE TASK ───
echo "── 1. UI create task ──"
TASK1=$(curl -s -X POST "http://$HOST/api/collections/tasks/records" \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"title":"regression-ui-task","status":"todo"}')
TASK1_ID=$(echo "$TASK1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [ -n "$TASK1_ID" ]; then ok "created: $TASK1_ID"; else fail "create failed" "$TASK1"; fi

# ─── 2. API CREATE TASK (validate-create) ──
echo "── 2. API create task (validate-create) ──"
TASK2=$(curl -s -X POST "http://$HOST/api/validate-create" \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"type":"task","title":"regression-api-task","priority":"high"}')
TASK2_OK=$(echo "$TASK2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('validated',False))" 2>/dev/null)
TASK2_ID=$(echo "$TASK2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
check "$TASK2_OK" "True" "validated: $TASK2_ID"

# ─── 3. API CREATE GROCERY ──
echo "── 3. API create grocery ──"
SHOP=$(curl -s -X POST "http://$HOST/api/validate-create" \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"type":"grocery","title":"regression-grocery","quantity":3}')
GROC_OK=$(echo "$SHOP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('validated',False))" 2>/dev/null)
check "$GROC_OK" "True" "grocery validated"

# ─── 4. SECOND USER SEES TASK ──
if [ -n "$TOKEN2" ]; then
  echo "── 4. Second user sees task ──"
  VISIBLE=$(curl -s "http://$HOST/api/collections/tasks/records?filter=id%3D%27$TASK1_ID%27" \
    -H "Authorization: Bearer $TOKEN2")
  VIS_COUNT=$(echo "$VISIBLE" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('items',[])))" 2>/dev/null)
  check "$VIS_COUNT" "1" "task visible to user2"

  # ─── 5. Second user edits task ──
  echo "── 5. Second user edits task ──"
  EDIT=$(curl -s -X PATCH "http://$HOST/api/collections/tasks/records/$TASK1_ID" \
    -H "Authorization: Bearer $TOKEN2" \
    -H "Content-Type: application/json" \
    -d '{"status":"blocked"}')
  EDIT_STATUS=$(echo "$EDIT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)
  check "$EDIT_STATUS" "blocked" "edit by user2"
fi

# ─── 6. DELETE WORKS ──
echo "── 6. Delete works ──"
DEL=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "http://$HOST/api/collections/tasks/records/$TASK2_ID" \
  -H "Authorization: Bearer $TOKEN1")
check "$DEL" "204" "delete TASK2"

# ─── 7. FILTERS/CHIPS ──
echo "── 7. Filters still function ──"
FILTER=$(curl -s "http://$HOST/api/collections/tasks/records?filter=status%3D%27todo%27" \
  -H "Authorization: Bearer $TOKEN1")
FILT_COUNT=$(echo "$FILTER" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('items',[])))" 2>/dev/null)
if [ "$FILT_COUNT" -ge 0 ] 2>/dev/null; then ok "filter returned $FILT_COUNT records"; else fail "filter failed"; fi

# ─── 8. ENRICHED HOOK: family_id auto-set ──
echo "── 8. family_id auto-set by canonical hook ──"
TASK3=$(curl -s -X POST "http://$HOST/api/collections/tasks/records" \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"title":"regression-hook-test"}')
TASK3_FID=$(echo "$TASK3" | python3 -c "import sys,json; print(json.load(sys.stdin).get('family_id','NONE'))" 2>/dev/null)
if [ "$TASK3_FID" != "NONE" ] && [ "$TASK3_FID" != "" ]; then ok "family_id set: $TASK3_FID"; else fail "family_id missing"; fi
# Cleanup
TASK3_ID=$(echo "$TASK3" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
curl -s -X DELETE "http://$HOST/api/collections/tasks/records/$TASK3_ID" -H "Authorization: Bearer $TOKEN1" > /dev/null

# ─── SUMMARY ──
echo ""
echo "═══ Results: $PASS passed, $FAIL failed ═══"
[ "$FAIL" -eq 0 ] && echo "✅ ALL CHECKS PASSED" || echo "❌ SOME CHECKS FAILED"
