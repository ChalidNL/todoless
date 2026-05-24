# Validation Checklist — Merge to Main

Before merging `dev` → `main`, verify ALL items.  
If any item fails, the merge is blocked until fixed in dev.

## Quick Validation (5 min)

- [ ] **App starts**: `curl -o /dev/null -w '%{http_code}' http://192.168.2.150:7070/` → 200
- [ ] **API health**: `curl http://192.168.2.150:7070/api/health` → `{"code":200}`
- [ ] **Hooks loaded**: `curl http://192.168.2.150:7070/api/hook-health` → `{"ok":true}`
- [ ] **Version endpoint**: `curl http://192.168.2.150:7070/api/version` → returns commit hash
- [ ] **Docker healthy**: Both containers show `healthy` in `docker ps`

## Core Functionality (10 min)

- [ ] **Login**: User can log in with existing credentials
- [ ] **Register**: New user can register via `/api/register`
- [ ] **Create task**: Logged-in user can create a task (API or UI)
- [ ] **Task has defaults**: Created task has `status=todo`, `flag=false`, `is_private=false`, `family_id` set
- [ ] **Create grocery item**: Can create item with `type=grocery` and `shop` relation
- [ ] **API token**: Can create/list/revoke API tokens

## Multi-User Collaboration (10 min)

- [ ] **Cross-user visibility**: User A creates task → User B can see it
- [ ] **Cross-user edit**: User B can edit User A's task (if family permissions allow)
- [ ] **Cross-user complete**: User B can check off User A's task
- [ ] **Agent items**: Agent-created items visible to all family members
- [ ] **Family isolation**: Users in different families CANNOT see each other's data

## API Token Flow (5 min)

- [ ] **Token create**: `POST /api/v1/api-tokens` returns token (only visible ONCE)
- [ ] **Token toggle**: `PATCH /api/v1/api-tokens/:id/toggle` works
- [ ] **Token delete**: `DELETE /api/v1/api-tokens/:id` works
- [ ] **Token auth**: API call with `Authorization: Bearer <token>` works

## UI/UX (5 min)

- [ ] **No console errors**: Open browser devtools → no red errors on page load
- [ ] **Settings page**: `/settings` loads, shows version + commit info
- [ ] **Labels/shops visible**: All family labels and shops appear in dropdowns
- [ ] **Realtime**: Create item in one tab → appears in another tab without refresh

## Data Integrity

- [ ] **No NULL family_id**: `SELECT COUNT(*) FROM tasks WHERE family_id IS NULL` → 0
- [ ] **No NULL family_id**: Same for `items`, `shops`, `labels`
- [ ] **All users have family_id**: Every user record has non-empty `family_id`

## Regression (optional but recommended)

- [ ] **Run test suite**: `bash scripts/test-collaboration.sh 192.168.2.150 <token1> [token2]` — all 8 scenarios pass
- [ ] **Quality gate CI**: Green checkmark on latest `dev` commit in GitHub

---

## Sign-Off

| Role | Name | Date | Status |
|---|---|---|---|
| Developer | | | ✅ / ❌ |
| Reviewer | | | ✅ / ❌ |

**IF ALL ITEMS PASS** → merge `dev` to `main` → run `./scripts/deploy.sh main` on 192.168.2.100
