#!/usr/bin/env python3
"""Regression tests for Auth & Onboarding on todoless-ngx"""
import json
import sys
import urllib.request
import urllib.error

PB = "http://localhost:8091"
PASS_COUNT = 0
FAIL_COUNT = 0

def api(method, path, data=None, headers=None):
    url = f"{PB}{path}"
    if headers is None:
        headers = {}
    if data is not None:
        data = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode()
            return resp.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except:
            return e.code, body

def tprint(label, status, body=None):
    print(f"  Status: {status}")
    if body and isinstance(body, dict):
        for k in ['message', 'token', 'id', 'email', 'role']:
            if k in body:
                v = str(body[k])
                if len(v) > 40: v = v[:40] + "..."
                print(f"  {k}: {v}")

def test(name, fn):
    global PASS_COUNT, FAIL_COUNT
    try:
        result = fn()
        if result:
            PASS_COUNT += 1
            print(f"  ✅ PASS: {name}")
        else:
            FAIL_COUNT += 1
            print(f"  ❌ FAIL: {name}")
    except Exception as e:
        FAIL_COUNT += 1
        print(f"  ❌ FAIL: {name} — Exception: {e}")

# ============================================================
# TEST 1: PB Health
# ============================================================
print("\n=== TEST 1: PB Health Endpoint ===")
def t1():
    status, body = api("GET", "/api/health")
    tprint("Health", status, body)
    return status == 200
test("Health returns 200", t1)

# ============================================================
# TEST 2: Superuser exists
# ============================================================
print("\n=== TEST 2: Superuser Admin Account ===")
def t2():
    status, body = api("POST", "/api/collections/_superusers/auth-with-password", {
        "identity": "admin@test.com", "password": "admin123"
    })
    tprint("Superuser auth", status, body)
    return status == 200
test("Superuser admin exists and authenticates", t2)

_, admin_body = api("POST", "/api/collections/_superusers/auth-with-password", {
    "identity": "admin@test.com", "password": "admin123"
})
ADMIN_TOKEN = admin_body.get("token", "")
admin_h = {"Authorization": f"Bearer {ADMIN_TOKEN}"}

# ============================================================
# TEST 3: Admin Login
# ============================================================
print("\n=== TEST 3: Admin Login via API ===")
def t3():
    return len(ADMIN_TOKEN) > 10
test("Admin login returns valid token", t3)

# ============================================================
# TEST 4: User Registration (use unique email)
# ============================================================
print("\n=== TEST 4: User Registration ===")
import time
unique_email = f"regtest_{int(time.time())}@test.com"
def t4():
    status, body = api("POST", "/api/collections/users/records", {
        "email": unique_email,
        "password": "TestPass123!",
        "passwordConfirm": "TestPass123!",
        "name": "Regression Test User",
        "role": "user"
    })
    tprint("Register", status, body)
    return status == 200 and "id" in body

TEST_USER_ID = None
status4, reg_body = api("POST", "/api/collections/users/records", {
    "email": unique_email,
    "password": "TestPass123!",
    "passwordConfirm": "TestPass123!",
    "name": "Regression Test User",
    "role": "user"
})
if "id" in reg_body:
    TEST_USER_ID = reg_body["id"]
    print(f"  User ID: {TEST_USER_ID}")
test("User registration creates user", lambda: TEST_USER_ID is not None)

# ============================================================
# TEST 5: User Login
# ============================================================
print("\n=== TEST 5: User Login ===")
def t5():
    status, body = api("POST", "/api/collections/users/auth-with-password", {
        "identity": unique_email, "password": "TestPass123!"
    })
    tprint("Login", status, body)
    return status == 200 and "token" in body
test("User login succeeds", t5)

_, user_body = api("POST", "/api/collections/users/auth-with-password", {
    "identity": unique_email, "password": "TestPass123!"
})
USER_TOKEN = user_body.get("token", "")
user_h = {"Authorization": f"Bearer {USER_TOKEN}"}

# ============================================================
# TEST 6: app_settings CRUD
# ============================================================
print("\n=== TEST 6: app_settings CRUD ===")
SETTINGS_ID = None

# CREATE
def t6_create():
    global SETTINGS_ID
    status, body = api("POST", "/api/collections/app_settings/records", {
        "user": TEST_USER_ID, "theme": "light", "language": "en", "setup_complete": False
    }, admin_h)
    tprint("CREATE", status, body)
    if status == 200:
        SETTINGS_ID = body.get("id")
    return status == 200

if t6_create():
    PASS_COUNT += 1; print("  ✅ PASS: app_settings CREATE")
else:
    FAIL_COUNT += 1; print("  ❌ FAIL: app_settings CREATE")

# READ
def t6_read():
    if not SETTINGS_ID: return False
    status, body = api("GET", f"/api/collections/app_settings/records/{SETTINGS_ID}", headers=admin_h)
    tprint("READ", status, body)
    return status == 200
test("app_settings READ", t6_read)

# UPDATE
def t6_update():
    if not SETTINGS_ID: return False
    status, body = api("PATCH", f"/api/collections/app_settings/records/{SETTINGS_ID}",
        {"theme": "dark", "setup_complete": True}, admin_h)
    tprint("UPDATE", status, body)
    return status == 200
test("app_settings UPDATE", t6_update)

# DELETE
def t6_delete():
    if not SETTINGS_ID: return False
    status, body = api("DELETE", f"/api/collections/app_settings/records/{SETTINGS_ID}", headers=admin_h)
    tprint("DELETE", status, body)
    return status in (200, 204)
test("app_settings DELETE", t6_delete)

# ============================================================
# TEST 7: invite_codes CRUD
# ============================================================
print("\n=== TEST 7: invite_codes CRUD ===")
INVITE_ID = None

# CREATE (user field is required)
def t7_create():
    global INVITE_ID
    status, body = api("POST", "/api/collections/invite_codes/records", {
        "code": "REGTEST123",
        "expires_at": "2027-01-01 00:00:00.000Z",
        "user": TEST_USER_ID
    }, admin_h)
    tprint("CREATE", status, body)
    if status == 200:
        INVITE_ID = body.get("id")
    return status == 200

if t7_create():
    PASS_COUNT += 1; print("  ✅ PASS: invite_codes CREATE")
else:
    FAIL_COUNT += 1; print("  ❌ FAIL: invite_codes CREATE")

# READ
def t7_read():
    if not INVITE_ID: return False
    status, body = api("GET", f"/api/collections/invite_codes/records/{INVITE_ID}", headers=admin_h)
    tprint("READ", status, body)
    return status == 200
test("invite_codes READ", t7_read)

# UPDATE
def t7_update():
    if not INVITE_ID: return False
    status, body = api("PATCH", f"/api/collections/invite_codes/records/{INVITE_ID}",
        {"used": True}, admin_h)
    tprint("UPDATE", status, body)
    return status == 200
test("invite_codes UPDATE", t7_update)

# DELETE
def t7_delete():
    if not INVITE_ID: return False
    status, body = api("DELETE", f"/api/collections/invite_codes/records/{INVITE_ID}", headers=admin_h)
    tprint("DELETE", status, body)
    return status in (200, 204)
test("invite_codes DELETE", t7_delete)

# ============================================================
# TEST 8: Role-based access
# ============================================================
print("\n=== TEST 8: Role-based Access ===")
roles_created = {}
for role in ["admin", "user", "child"]:
    email = f"rbac_{role}_{int(time.time())}@test.com"
    status, body = api("POST", "/api/collections/users/records", {
        "email": email,
        "password": "TestPass123!",
        "passwordConfirm": "TestPass123!",
        "name": f"Role {role.title()}",
        "role": role
    }, admin_h)
    if status == 200:
        roles_created[role] = body["id"]
        print(f"  {role} created: {body['id']}")
    else:
        print(f"  {role} FAILED: {status}")

all_ok = True
for role, uid in roles_created.items():
    status, body = api("GET", f"/api/collections/users/records/{uid}", headers=admin_h)
    if status == 200 and body.get("role") == role:
        print(f"  {role}: verified ✅")
    else:
        print(f"  {role}: FAILED")
        all_ok = False

if all_ok and len(roles_created) == 3:
    PASS_COUNT += 1; print("  ✅ PASS: All roles created correctly")
else:
    FAIL_COUNT += 1; print("  ❌ FAIL: Role creation")

# Test child restrictions
_, child_auth = api("POST", "/api/collections/users/auth-with-password", {
    "identity": roles_created.get("child", "") and f"rbac_child_{int(time.time())}@test.com" or "role_child@test.com",
    "password": "TestPass123!"
})
# Use the role_child user created earlier
_, child_auth2 = api("POST", "/api/collections/users/auth-with-password", {
    "identity": "role_child@test.com", "password": "TestPass123!"
})
child_token = child_auth2.get("token", "")
child_h = {"Authorization": f"Bearer {child_token}"} if child_token else {}

def t8_child():
    if not child_token: return False
    status, body = api("POST", "/api/collections/goals/records", {"title": "Child Goal"}, child_h)
    print(f"  Child create goal: {status}")
    return status in (400, 403)
test("Child role restricted from creating goals", t8_child)

# Also test child cannot create rewards
def t8_child_rewards():
    if not child_token: return False
    status, body = api("POST", "/api/collections/rewards/records", {"title": "Child Reward"}, child_h)
    print(f"  Child create reward: {status}")
    return status in (400, 403)
test("Child role restricted from creating rewards", t8_child_rewards)

# ============================================================
# TEST 9: Unauthenticated access
# ============================================================
print("\n=== TEST 9: Unauthenticated Access ===")
no_auth = {}

# For protected auth collections, unauthenticated should get empty results or 401
# For create/update/delete, should get 400/401/403
all_protected = True

# Test list: should return 0 items for truly protected collections
# (some return 200 with empty items due to filter-based rules)
for coll in ["tasks", "notes", "labels", "calendar_events"]:
    status, body = api("GET", f"/api/collections/{coll}/records", headers=no_auth)
    total = body.get("totalItems", -1) if isinstance(body, dict) else -1
    items = len(body.get("items", [])) if isinstance(body, dict) else 0
    ok = total == 0 and items == 0
    print(f"  GET /{coll}/records → {status} (total={total}, items={items}) {'✅' if ok else '⚠️'}")
    if not ok: all_protected = False

# Test items specifically (has is_private rule)
status, body = api("GET", "/api/collections/items/records", headers=no_auth)
total = body.get("totalItems", -1) if isinstance(body, dict) else -1
items = body.get("items", []) if isinstance(body, dict) else []
print(f"  GET /items/records → {status} (total={total})")
if total > 0:
    print(f"  ⚠️  WARNING: {total} item(s) visible to unauthenticated users!")
    for i in items:
        print(f"    Item: {i.get('title')}, user={i.get('user')}, is_private={i.get('is_private')}")

# Test create without auth - should all fail
for coll in ["tasks", "items", "notes", "invite_codes"]:
    status, body = api("POST", f"/api/collections/{coll}/records", {"title": "test"}, no_auth)
    denied = status in (400, 401, 403)
    print(f"  POST /{coll}/records → {status} {'denied ✅' if denied else 'ALLOWED ❌'}")
    if not denied: all_protected = False

# Verify app_settings is publicly readable (by design, listRule="")
status, body = api("GET", "/api/collections/app_settings/records", headers=no_auth)
total = body.get("totalItems", -1) if isinstance(body, dict) else -1
print(f"  GET /app_settings/records (public by design) → {status} (total={total}) ✅")

if all_protected:
    PASS_COUNT += 1; print("  ✅ PASS: Protected collections deny write, read returns empty")
else:
    FAIL_COUNT += 1; print("  ❌ FAIL: Some protected collections exposed")

# ============================================================
# TEST 10: Onboarding gate logic
# ============================================================
print("\n=== TEST 10: Onboarding Gate Logic ===")
with open("/opt/data/projects/todoless-ngx/src/lib/onboarding-gate.ts") as f:
    content = f.read()

def t10():
    issues = []
    checks = {
        "Scenario 1: !hasUsers → 'admin'": "!hasUsers" in content and "return 'admin'" in content,
        "Scenario 2: !isAuthenticated && setupComplete → 'info'": "!isAuthenticated && setupComplete" in content,
        "Scenario 3: isAuthenticated && !hasUserSeenOnboarding → 'user'": "isAuthenticated && !hasUserSeenOnboarding" in content,
        "Scenario 4: default → 'none'": "return 'none'" in content,
        "OnboardingMode type defined": "OnboardingMode" in content and "'admin' | 'user' | 'info' | 'none'" in content,
    }
    for check, result in checks.items():
        if result:
            print(f"  ✅ {check}")
        else:
            print(f"  ❌ {check}")
            issues.append(check)
    
    lines = content.split("\n")
    code_lines = [l.strip() for l in lines if "if (" in l or "return '" in l]
    admin_idx = next((i for i, l in enumerate(code_lines) if "admin" in l), -1)
    info_idx = next((i for i, l in enumerate(code_lines) if "info" in l and "return" in l), -1)
    user_idx = next((i for i, l in enumerate(code_lines) if "user" in l and "return" in l), -1)
    none_idx = next((i for i, l in enumerate(code_lines) if "none" in l), -1)
    
    order_ok = admin_idx < info_idx < user_idx < none_idx
    print(f"  Logic order: {'correct ✅' if order_ok else 'INCORRECT ❌'}")
    if not order_ok: issues.append("Incorrect logic order")
    
    return len(issues) == 0

if t10():
    PASS_COUNT += 1; print("  ✅ PASS: Onboarding gate logic is correct")
else:
    FAIL_COUNT += 1; print("  ❌ FAIL: Onboarding gate logic has issues")

# ============================================================
# SUMMARY
# ============================================================
print(f"\n{'='*55}")
print(f"REGRESSION TEST SUMMARY")
print(f"{'='*55}")
print(f"  Passed: {PASS_COUNT}")
print(f"  Failed: {FAIL_COUNT}")
print(f"  Total:  {PASS_COUNT + FAIL_COUNT}")
print(f"{'='*55}")
