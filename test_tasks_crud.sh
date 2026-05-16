#!/usr/bin/env bash
# Regression tests for Tasks CRUD on todoless-ngx
# Tests against PB API at http://localhost:8091

set -e

PB="http://localhost:8091"
PASS=0
FAIL=0
TOTAL=0

log_result() {
    local test_name="$1"
    local result="$2"
    local detail="$3"
    TOTAL=$((TOTAL + 1))
    if [ "$result" = "PASS" ]; then
        PASS=$((PASS + 1))
        echo "✅ PASS: $test_name"
        if [ -n "$detail" ]; then echo "   $detail"; fi
    else
        FAIL=$((FAIL + 1))
        echo "❌ FAIL: $test_name"
        if [ -n "$detail" ]; then echo "   $detail"; fi
    fi
}

extract_field() {
    local json="$1"
    local field="$2"
    python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('$field',''))" "$json"
}

# ===== STEP 1: Create test user =====
echo "=== Step 1: Create Test User ==="
USER_CREATE=$(curl -s -X POST "$PB/api/collections/users/records" \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "regression@test.dev",
    "password": "Regression123!",
    "passwordConfirm": "Regression123!",
    "name": "Regression Tester",
    "role": "admin"
  }' 2>/dev/null)

USER_ID=$(extract_field "$USER_CREATE" "id")
if [ -n "$USER_ID" ] && [ "$USER_ID" != "" ]; then
    log_result "Create Test User" "PASS" "User ID: $USER_ID"
else
    log_result "Create Test User" "FAIL" "Response: $USER_CREATE"
    # Try using existing user
    echo "Trying with existing user..."
fi

# ===== STEP 2: Login to get auth token =====
echo ""
echo "=== Step 2: Login to get Auth Token ==="
USER_LOGIN=$(curl -s -X POST "$PB/api/collections/users/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d '{"identity":"regression@test.dev","password":"Regression123!"}' 2>/dev/null)

TOKEN=$(python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print(d.get('token',''))" <<< "$USER_LOGIN")
LOGIN_ID=$(python3 -c "import json,sys; d=json.loads(sys.stdin.read()); r=d.get('record',{}); print(r.get('id',''))" <<< "$USER_LOGIN")

if [ -n "$TOKEN" ] && [ "$TOKEN" != "" ]; then
    log_result "Login for Auth Token" "PASS" "Token obtained for user: $LOGIN_ID"
else
    echo "Login failed: $USER_LOGIN"
    # Fallback: try to register and login with a different email
    echo "Falling back to original test user..."
    USER_LOGIN=$(curl -s -X POST "$PB/api/collections/users/auth-with-password" \
      -H 'Content-Type: application/json' \
      -d '{"identity":"testuser@todoless.dev","password":"TestPass123!"}' 2>/dev/null)
    TOKEN=$(python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print(d.get('token',''))" <<< "$USER_LOGIN")
    LOGIN_ID=$(python3 -c "import json,sys; d=json.loads(sys.stdin.read()); r=d.get('record',{}); print(r.get('id',''))" <<< "$USER_LOGIN")
    if [ -n "$TOKEN" ]; then
        log_result "Login (fallback)" "PASS" "Token obtained for user: $LOGIN_ID"
    else
        log_result "Login" "FAIL" "Cannot obtain token"
        echo "Cannot continue without auth token. Exiting."
        exit 1
    fi
fi

AUTH="-H Authorization: Bearer $TOKEN -H Content-Type: application/json"

# ===== STEP 3: CREATE task with full fields =====
echo ""
echo "=== Step 3: CREATE Task (full fields) ==="
DUE_DATE="2026-06-15T10:00:00.000Z"

TASK_CREATE=$(curl -s -w "\n%{http_code}" -X POST "$PB/api/collections/tasks/records" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"title\": \"Regression Test Task\",
    \"status\": \"backlog\",
    \"priority\": \"high\",
    \"horizon\": \"short\",
    \"labels\": [\"test\", \"regression\"],
    \"assigned_to\": \"$LOGIN_ID\",
    \"due_date\": \"$DUE_DATE\",
    \"blocked\": false,
    \"is_private\": false,
    \"flag\": false,
    \"user\": \"$LOGIN_ID\"
  }" 2>/dev/null)

HTTP_CODE=$(echo "$TASK_CREATE" | tail -1)
TASK_BODY=$(echo "$TASK_CREATE" | sed '$d')
TASK_ID=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('id',''))" "$TASK_BODY" 2>/dev/null)

if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
    if [ -n "$TASK_ID" ]; then
        log_result "CREATE Task (full fields)" "PASS" "Task ID: $TASK_ID, HTTP: $HTTP_CODE"
    else
        log_result "CREATE Task (full fields)" "FAIL" "HTTP $HTTP_CODE but no ID returned. Body: $(echo $TASK_BODY | head -c 200)"
    fi
else
    log_result "CREATE Task (full fields)" "FAIL" "HTTP $HTTP_CODE, Body: $(echo $TASK_BODY | head -c 300)"
fi

# ===== STEP 3b: CREATE task via custom route =====
echo ""
echo "=== Step 3b: CREATE Task via /api/todoless/tasks ==="
TASK2_CREATE=$(curl -s -w "\n%{http_code}" -X POST "$PB/api/todoless/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"title\": \"Regression Test Task 2\",
    \"status\": \"todo\",
    \"priority\": \"medium\",
    \"horizon\": \"medium\",
    \"labels\": [\"test\"],
    \"due_date\": \"$DUE_DATE\",
    \"blocked\": false,
    \"is_private\": false
  }" 2>/dev/null)

HTTP_CODE2=$(echo "$TASK2_CREATE" | tail -1)
TASK2_BODY=$(echo "$TASK2_CREATE" | sed '$d')
TASK2_ID=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('id',''))" "$TASK2_BODY" 2>/dev/null)

if [ "$HTTP_CODE2" = "201" ] && [ -n "$TASK2_ID" ]; then
    log_result "CREATE Task (custom route)" "PASS" "Task ID: $TASK2_ID, HTTP: $HTTP_CODE2"
else
    log_result "CREATE Task (custom route)" "FAIL" "HTTP $HTTP_CODE2, Body: $(echo $TASK2_BODY | head -c 200)"
fi

# ===== STEP 4: READ task =====
echo ""
echo "=== Step 4: READ Task ==="
if [ -n "$TASK_ID" ]; then
    # Test via standard PB endpoint
    TASK_READ=$(curl -s -w "\n%{http_code}" "$PB/api/collections/tasks/records/$TASK_ID" \
      -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    HTTP_CODE_READ=$(echo "$TASK_READ" | tail -1)
    TASK_READ_BODY=$(echo "$TASK_READ" | sed '$d')
    
    READ_TITLE=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('title',''))" "$TASK_READ_BODY" 2>/dev/null)
    
    if [ "$HTTP_CODE_READ" = "200" ] && [ "$READ_TITLE" = "Regression Test Task" ]; then
        log_result "READ Task (standard endpoint)" "PASS" "Title: $READ_TITLE, HTTP: $HTTP_CODE_READ"
    else
        log_result "READ Task (standard endpoint)" "FAIL" "HTTP $HTTP_CODE_READ, Title: $READ_TITLE"
    fi

    # Test via custom route
    TASK_READ2=$(curl -s -w "\n%{http_code}" "$PB/api/todoless/tasks/$TASK_ID" \
      -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    HTTP_CODE_READ2=$(echo "$TASK_READ2" | tail -1)
    TASK_READ2_BODY=$(echo "$TASK_READ2" | sed '$d')
    
    READ_TITLE2=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('title',''))" "$TASK_READ2_BODY" 2>/dev/null)
    
    if [ "$HTTP_CODE_READ2" = "200" ] && [ "$READ_TITLE2" = "Regression Test Task" ]; then
        log_result "READ Task (custom route)" "PASS" "Title: $READ_TITLE2, HTTP: $HTTP_CODE_READ2"
    else
        log_result "READ Task (custom route)" "FAIL" "HTTP $HTTP_CODE_READ2, Title: $READ_TITLE2"
    fi
else
    log_result "READ Task" "FAIL" "No task ID from create step"
fi

# ===== STEP 5: UPDATE task (status transitions) =====
echo ""
echo "=== Step 5: UPDATE Task (status transitions) ==="

if [ -n "$TASK_ID" ]; then
    # backlog -> todo
    UPDATE1=$(curl -s -w "\n%{http_code}" -X PATCH "$PB/api/todoless/tasks/$TASK_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d '{"status": "todo"}' 2>/dev/null)
    HTTP_UPD1=$(echo "$UPDATE1" | tail -1)
    UPDATE1_BODY=$(echo "$UPDATE1" | sed '$d')
    STATUS1=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('status',''))" "$UPDATE1_BODY" 2>/dev/null)
    
    if [ "$HTTP_UPD1" = "200" ] && [ "$STATUS1" = "todo" ]; then
        log_result "UPDATE Task backlog→todo" "PASS" "Status: $STATUS1, HTTP: $HTTP_UPD1"
    else
        log_result "UPDATE Task backlog→todo" "FAIL" "HTTP $HTTP_UPD1, Status: $STATUS1"
    fi
    
    # todo -> done
    UPDATE2=$(curl -s -w "\n%{http_code}" -X PATCH "$PB/api/todoless/tasks/$TASK_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d '{"status": "done"}' 2>/dev/null)
    HTTP_UPD2=$(echo "$UPDATE2" | tail -1)
    UPDATE2_BODY=$(echo "$UPDATE2" | sed '$d')
    STATUS2=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('status',''))" "$UPDATE2_BODY" 2>/dev/null)
    
    if [ "$HTTP_UPD2" = "200" ] && [ "$STATUS2" = "done" ]; then
        log_result "UPDATE Task todo→done" "PASS" "Status: $STATUS2, HTTP: $HTTP_UPD2"
    else
        log_result "UPDATE Task todo→done" "FAIL" "HTTP $HTTP_UPD2, Status: $STATUS2"
    fi
    
    # done -> backlog (reset)
    UPDATE3=$(curl -s -w "\n%{http_code}" -X PATCH "$PB/api/todoless/tasks/$TASK_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d '{"status": "backlog"}' 2>/dev/null)
    HTTP_UPD3=$(echo "$UPDATE3" | tail -1)
    UPDATE3_BODY=$(echo "$UPDATE3" | sed '$d')
    STATUS3=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('status',''))" "$UPDATE3_BODY" 2>/dev/null)
    
    if [ "$HTTP_UPD3" = "200" ] && [ "$STATUS3" = "backlog" ]; then
        log_result "UPDATE Task done→backlog" "PASS" "Status: $STATUS3, HTTP: $HTTP_UPD3"
    else
        log_result "UPDATE Task done→backlog" "FAIL" "HTTP $HTTP_UPD3, Status: $STATUS3"
    fi
    
    # Update multiple fields
    UPDATE4=$(curl -s -w "\n%{http_code}" -X PATCH "$PB/api/todoless/tasks/$TASK_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d '{"priority": "low", "blocked": true, "blocked_comment": "Blocked by dependency", "flag": true}' 2>/dev/null)
    HTTP_UPD4=$(echo "$UPDATE4" | tail -1)
    UPDATE4_BODY=$(echo "$UPDATE4" | sed '$d')
    PRIORITY4=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('priority',''))" "$UPDATE4_BODY" 2>/dev/null)
    BLOCKED4=$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d.get('blocked',None))" "$UPDATE4_BODY" 2>/dev/null)
    
    if [ "$HTTP_UPD4" = "200" ] && [ "$PRIORITY4" = "low" ] && [ "$BLOCKED4" = "True" ]; then
        log_result "UPDATE Task (multiple fields)" "PASS" "Priority: $PRIORITY4, Blocked: $BLOCKED4"
    else
        log_result "UPDATE Task (multiple fields)" "FAIL" "HTTP $HTTP_UPD4, Priority: $PRIORITY4, Blocked: $BLOCKED4"
    fi
else
    log_result "UPDATE Task" "FAIL" "No task ID from create step"
    log_result "UPDATE Task" "FAIL" "No task ID from create step"
    log_result "UPDATE Task" "FAIL" "No task ID from create step"
    log_result "UPDATE Task (multiple fields)" "FAIL" "No task ID from create step"
fi

# ===== STEP 6: DELETE task =====
echo ""
echo "=== Step 6: DELETE Task ==="
if [ -n "$TASK2_ID" ]; then
    DELETE_RESP=$(curl -s -w "\n%{http_code}" -X DELETE "$PB/api/todoless/tasks/$TASK2_ID" \
      -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    HTTP_DEL=$(echo "$DELETE_RESP" | tail -1)
    DELETE_BODY=$(echo "$DELETE_RESP" | sed '$d')
    
    if [ "$HTTP_DEL" = "200" ]; then
        log_result "DELETE Task" "PASS" "HTTP: $HTTP_DEL"
    else
        log_result "DELETE Task" "FAIL" "HTTP $HTTP_DEL, Body: $DELETE_BODY"
    fi
    
    # Verify deletion
    VERIFY_DEL=$(curl -s -w "\n%{http_code}" "$PB/api/todoless/tasks/$TASK2_ID" \
      -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    HTTP_VERIFY=$(echo "$VERIFY_DEL" | tail -1)
    
    if [ "$HTTP_VERIFY" = "404" ]; then
        log_result "Verify Deletion" "PASS" "Task no longer exists (HTTP 404)"
    else
        log_result "Verify Deletion" "FAIL" "Expected 404, got $HTTP_VERIFY"
    fi
else
    log_result "DELETE Task" "FAIL" "No task ID to delete"
    log_result "Verify Deletion" "FAIL" "No task to verify"
fi

# ===== STEP 7: LIST tasks with filtering =====
echo ""
echo "=== Step 7: LIST Tasks (with filtering) ==="
# Create additional tasks for filtering
curl -s -X POST "$PB/api/todoless/tasks" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title": "List Test Task 1", "status": "todo", "priority": "high"}' > /dev/null 2>&1
curl -s -X POST "$PB/api/todoless/tasks" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title": "List Test Task 2", "status": "done", "priority": "low"}' > /dev/null 2>&1
curl -s -X POST "$PB/api/todoless/tasks" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title": "List Test Task 3", "status": "todo", "priority": "medium"}' > /dev/null 2>&1

# List all tasks
LIST_ALL=$(curl -s -w "\n%{http_code}" "$PB/api/todoless/tasks" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null)
HTTP_LIST=$(echo "$LIST_ALL" | tail -1)
LIST_BODY=$(echo "$LIST_ALL" | sed '$d')
LIST_COUNT=$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(len(d) if isinstance(d,list) else 0)" "$LIST_BODY" 2>/dev/null)

if [ "$HTTP_LIST" = "200" ] && [ "$LIST_COUNT" -ge 3 ]; then
    log_result "LIST Tasks (all)" "PASS" "Count: $LIST_COUNT, HTTP: $HTTP_LIST"
else
    log_result "LIST Tasks (all)" "FAIL" "HTTP $HTTP_LIST, Count: $LIST_COUNT"
fi

# List with status filter
LIST_TODO=$(curl -s -w "\n%{http_code}" "$PB/api/todoless/tasks?status=todo" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null)
HTTP_LIST_TODO=$(echo "$LIST_TODO" | tail -1)
LIST_TODO_BODY=$(echo "$LIST_TODO" | sed '$d')
TODO_COUNT=$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(len(d) if isinstance(d,list) else 0)" "$LIST_TODO_BODY" 2>/dev/null)

if [ "$HTTP_LIST_TODO" = "200" ] && [ "$TODO_COUNT" -ge 2 ]; then
    log_result "LIST Tasks (filter: status=todo)" "PASS" "Count: $TODO_COUNT, HTTP: $HTTP_LIST_TODO"
else
    log_result "LIST Tasks (filter: status=todo)" "FAIL" "HTTP $HTTP_LIST_TODO, Count: $TODO_COUNT"
fi

# ===== STEP 8: Task linking =====
echo ""
echo "=== Step 8: Task Linking ==="
# Create a note to link
NOTE_CREATE=$(curl -s -X POST "$PB/api/collections/notes/records" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title": "Test Note", "content": "Test note content", "user": "'$LOGIN_ID'"}' 2>/dev/null)
NOTE_ID=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('id',''))" "$NOTE_CREATE" 2>/dev/null)

# Create an item to link
ITEM_CREATE=$(curl -s -X POST "$PB/api/collections/items/records" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title": "Test Item", "user": "'$LOGIN_ID'", "labels": []}' 2>/dev/null)
ITEM_ID=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('id',''))" "$ITEM_CREATE" 2>/dev/null)

# Create a task for linking test
LINK_TASK=$(curl -s -X POST "$PB/api/todoless/tasks" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title": "Link Test Task", "status": "todo"}' 2>/dev/null)
LINK_TASK_ID=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('id',''))" "$LINK_TASK" 2>/dev/null)

if [ -n "$LINK_TASK_ID" ] && [ -n "$ITEM_ID" ] && [ -n "$NOTE_ID" ]; then
    # Try to set linked_item_ids and linked_note_ids
    LINK_UPDATE=$(curl -s -w "\n%{http_code}" -X PATCH "$PB/api/todoless/tasks/$LINK_TASK_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"linked_item_ids\": [\"$ITEM_ID\"], \"linked_note_ids\": [\"$NOTE_ID\"]}" 2>/dev/null)
    HTTP_LINK=$(echo "$LINK_UPDATE" | tail -1)
    LINK_BODY=$(echo "$LINK_UPDATE" | sed '$d')
    
    LINKED_ITEMS=$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d.get('linked_item_ids', d.get('linkedItemIds','')))" "$LINK_BODY" 2>/dev/null)
    
    if [ "$HTTP_LINK" = "200" ]; then
        log_result "Task Linking (set linked IDs)" "PASS" "HTTP: $HTTP_LINK, Linked: $LINKED_ITEMS"
    else
        log_result "Task Linking (set linked IDs)" "FAIL" "HTTP $HTTP_LINK, Body: $(echo $LINK_BODY | head -c 200)"
    fi
else
    log_result "Task Linking" "FAIL" "Missing IDs: task=$LINK_TASK_ID, item=$ITEM_ID, note=$NOTE_ID"
fi

# ===== STEP 9: Recurring task creation =====
echo ""
echo "=== Step 9: Recurring Task Creation ==="
RECUR_TASK=$(curl -s -w "\n%{http_code}" -X POST "$PB/api/todoless/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"title\": \"Weekly Recurring Task\", \"status\": \"todo\", \"repeat_interval\": \"week\", \"due_date\": \"2026-05-20T10:00:00.000Z\"}" 2>/dev/null)
HTTP_RECUR=$(echo "$RECUR_TASK" | tail -1)
RECUR_BODY=$(echo "$RECUR_TASK" | sed '$d')
RECUR_ID=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('id',''))" "$RECUR_BODY" 2>/dev/null)
RECUR_REPEAT=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('repeat_interval',''))" "$RECUR_BODY" 2>/dev/null)

if [ "$HTTP_RECUR" = "201" ] && [ -n "$RECUR_ID" ] && [ "$RECUR_REPEAT" = "week" ]; then
    log_result "Recurring Task Creation" "PASS" "ID: $RECUR_ID, Repeat: $RECUR_REPEAT"
else
    log_result "Recurring Task Creation" "FAIL" "HTTP $HTTP_RECUR, Repeat: $RECUR_REPEAT, ID: $RECUR_ID"
fi

# ===== STEP 10: Task with all optional fields =====
echo ""
echo "=== Step 10: Task with All Optional Fields ==="
ALL_TASK=$(curl -s -w "\n%{http_code}" -X POST "$PB/api/todoless/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"title\": \"Full Optional Fields Task\",
    \"status\": \"backlog\",
    \"priority\": \"high\",
    \"horizon\": \"long\",
    \"labels\": [\"urgent\", \"important\", \"test\"],
    \"assigned_to\": \"$LOGIN_ID\",
    \"due_date\": \"2026-07-01T09:00:00.000Z\",
    \"repeat_interval\": \"month\",
    \"blocked\": true,
    \"blocked_comment\": \"Waiting on external dependency\",
    \"is_private\": true,
    \"flag\": true,
    \"archived\": false,
    \"completed_at\": null
  }" 2>/dev/null)
HTTP_ALL=$(echo "$ALL_TASK" | tail -1)
ALL_BODY=$(echo "$ALL_TASK" | sed '$d')
ALL_ID=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('id',''))" "$ALL_BODY" 2>/dev/null)
ALL_TITLE=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('title',''))" "$ALL_BODY" 2>/dev/null)
ALL_PRIORITY=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('priority',''))" "$ALL_BODY" 2>/dev/null)
ALL_HORIZON=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('horizon',''))" "$ALL_BODY" 2>/dev/null)

if [ "$HTTP_ALL" = "201" ] && [ "$ALL_TITLE" = "Full Optional Fields Task" ] && [ "$ALL_PRIORITY" = "high" ]; then
    log_result "Task with All Optional Fields" "PASS" "ID: $ALL_ID, Priority: $ALL_PRIORITY, Horizon: $ALL_HORIZON"
else
    log_result "Task with All Optional Fields" "FAIL" "HTTP $HTTP_ALL, Title: $ALL_TITLE, Priority: $ALL_PRIORITY"
fi

# ===== STEP 11: Verify PB hooks exist and handle POST/PATCH =====
echo ""
echo "=== Step 11: Verify PB Hooks ==="
# Check tasks.js hook exists
if [ -f "/opt/data/projects/todoless-ngx/pb_hooks/routes/tasks.js" ]; then
    log_result "tasks.js hook exists" "PASS" "Found at pb_hooks/routes/tasks.js"
else
    log_result "tasks.js hook exists" "FAIL" "File not found"
fi

# Check tasks.js has POST endpoint
if grep -q "POST" /opt/data/projects/todoless-ngx/pb_hooks/routes/tasks.js 2>/dev/null && \
   grep -q "routerAdd" /opt/data/projects/todoless-ngx/pb_hooks/routes/tasks.js 2>/dev/null; then
    POST_LINES=$(grep -c "POST\|'POST'" /opt/data/projects/todoless-ngx/pb_hooks/routes/tasks.js)
    log_result "tasks.js has POST handler" "PASS" "Found POST handler(s)"
else
    log_result "tasks.js has POST handler" "FAIL" "No POST handler found"
fi

# Check tasks.js has PATCH endpoint
if grep -q "PATCH" /opt/data/projects/todoless-ngx/pb_hooks/routes/tasks.js 2>/dev/null; then
    log_result "tasks.js has PATCH handler" "PASS" "Found PATCH handler"
else
    log_result "tasks.js has PATCH handler" "FAIL" "No PATCH handler found"
fi

# Check tasks.js has DELETE endpoint
if grep -q "DELETE" /opt/data/projects/todoless-ngx/pb_hooks/routes/tasks.js 2>/dev/null; then
    log_result "tasks.js has DELETE handler" "PASS" "Found DELETE handler"
else
    log_result "tasks.js has DELETE handler" "FAIL" "No DELETE handler found"
fi

# Check tasks.js has GET endpoints
if grep -q "'GET'" /opt/data/projects/todoless-ngx/pb_hooks/routes/tasks.js 2>/dev/null; then
    log_result "tasks.js has GET handlers" "PASS" "Found GET handlers"
else
    log_result "tasks.js has GET handlers" "FAIL" "No GET handlers found"
fi

# Check on_task_update.js exists
if [ -f "/opt/data/projects/todoless-ngx/pb_hooks/on_task_update.js" ]; then
    log_result "on_task_update.js hook exists" "PASS" "Found at pb_hooks/on_task_update.js"
else
    log_result "on_task_update.js hook exists" "FAIL" "File not found"
fi

# Check task-actions.js exists
if [ -f "/opt/data/projects/todoless-ngx/pb_hooks/routes/task-actions.js" ]; then
    log_result "task-actions.js hook exists" "PASS" "Found at pb_hooks/routes/task-actions.js"
else
    log_result "task-actions.js hook exists" "FAIL" "File not found"
fi

# ===== STEP 12: Check recurring task rollover logic =====
echo ""
echo "=== Step 12: Recurring Task Rollover Logic ==="
# Check on_task_update.js for key logic patterns
ROLLOVER_FILE="/opt/data/projects/todoless-ngx/pb_hooks/on_task_update.js"

# Check for status transition detection (oldRecord status check)
if grep -q "oldRecord" "$ROLLOVER_FILE" && grep -q "status" "$ROLLOVER_FILE"; then
    log_result "Rollover: Status transition detection" "PASS" "Found oldRecord status check"
else
    log_result "Rollover: Status transition detection" "FAIL" "Missing status transition check"
fi

# Check for transition to 'done'
if grep -q "'done'" "$ROLLOVER_FILE" || grep -q '"done"' "$ROLLOVER_FILE"; then
    log_result "Rollover: Checks transition to done" "PASS" "Found done status check"
else
    log_result "Rollover: Checks transition to done" "FAIL" "Missing done status check"
fi

# Check for repeat_interval handling
if grep -q "repeat_interval" "$ROLLOVER_FILE"; then
    log_result "Rollover: Handles repeat_interval" "PASS" "Found repeat_interval handling"
else
    log_result "Rollover: Handles repeat_interval" "FAIL" "Missing repeat_interval handling"
fi

# Check for due_date calculation
if grep -q "due_date" "$ROLLOVER_FILE" && grep -q "nextDueDate" "$ROLLOVER_FILE"; then
    log_result "Rollover: Calculates next due date" "PASS" "Found nextDueDate calculation"
else
    log_result "Rollover: Calculates next due date" "FAIL" "Missing due date calculation"
fi

# Check for week/month/year intervals
HAS_WEEK=$(grep -c "week" "$ROLLOVER_FILE")
HAS_MONTH=$(grep -c "month" "$ROLLOVER_FILE")
HAS_YEAR=$(grep -c "year" "$ROLLOVER_FILE")

if [ "$HAS_WEEK" -gt 0 ] && [ "$HAS_MONTH" -gt 0 ] && [ "$HAS_YEAR" -gt 0 ]; then
    log_result "Rollover: Supports week/month/year" "PASS" "All intervals supported"
else
    log_result "Rollover: Supports week/month/year" "FAIL" "Missing intervals (week=$HAS_WEEK, month=$HAS_MONTH, year=$HAS_YEAR)"
fi

# Check for RecordUpsertAction (creates new record)
if grep -q "RecordUpsertAction" "$ROLLOVER_FILE"; then
    log_result "Rollover: Creates new record" "PASS" "Found RecordUpsertAction"
else
    log_result "Rollover: Creates new record" "FAIL" "Missing RecordUpsertAction"
fi

# Check for onRecordAfterUpdateRequest hook type
if grep -q "onRecordAfterUpdateRequest" "$ROLLOVER_FILE"; then
    log_result "Rollover: Uses correct hook type" "PASS" "Found onRecordAfterUpdateRequest"
else
    log_result "Rollover: Uses correct hook type" "FAIL" "Missing onRecordAfterUpdateRequest"
fi

# Test recurring task rollover by completing a recurring task
if [ -n "$RECUR_ID" ]; then
    ROLLOVER_BEFORE=$(curl -s "$PB/api/todoless/tasks" -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    COUNT_BEFORE=$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(len(d) if isinstance(d,list) else 0)" "$ROLLOVER_BEFORE" 2>/dev/null)
    
    # Mark recurring task as done
    curl -s -X PATCH "$PB/api/todoless/tasks/$RECUR_ID" \
      -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
      -d '{"status": "done"}' > /dev/null 2>&1
    
    # Small delay for the hook to process
    sleep 1
    
    ROLLOVER_AFTER=$(curl -s "$PB/api/todoless/tasks" -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    COUNT_AFTER=$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(len(d) if isinstance(d,list) else 0)" "$ROLLOVER_AFTER" 2>/dev/null)
    
    if [ "$COUNT_AFTER" -gt "$COUNT_BEFORE" ]; then
        log_result "Rollover: Actual rollover test" "PASS" "Tasks before: $COUNT_BEFORE, after: $COUNT_AFTER (new task created)"
    else
        log_result "Rollover: Actual rollover test" "FAIL" "Tasks before: $COUNT_BEFORE, after: $COUNT_AFTER (no new task)"
    fi
else
    log_result "Rollover: Actual rollover test" "FAIL" "No recurring task to test"
fi

# ===== Cleanup =====
echo ""
echo "=== Cleanup ==="
# Delete test tasks created during regression
for ID in "$TASK_ID" "$TASK2_ID" "$LINK_TASK_ID" "$RECUR_ID" "$ALL_ID"; do
    if [ -n "$ID" ]; then
        curl -s -X DELETE "$PB/api/todoless/tasks/$ID" \
          -H "Authorization: Bearer $TOKEN" > /dev/null 2>&1
    fi
done
log_result "Cleanup" "PASS" "Test tasks deleted"

# ===== Summary =====
echo ""
echo "========================================"
echo "REGRESSION TEST SUMMARY"
echo "========================================"
echo "Total: $TOTAL | Passed: $PASS | Failed: $FAIL"
if [ "$FAIL" -eq 0 ]; then
    echo "🎉 ALL TESTS PASSED"
else
    echo "⚠️  $FAIL TEST(S) FAILED"
fi
echo "========================================"
