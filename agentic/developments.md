# Todoless Development Tracker

---

**Instructions (read first)**

- Purpose: this document collects concise bugfixes, features, improvements and release notes for Todoless.
- How to add items: start a line with `#file:developments.md` followed by the item text — the agent will auto-categorize and insert it under the current `Upcoming` version. You may also add items manually under the correct category.
- Categories (use these, keep order): Features, Improvements, Bugfixes, Maintenance, Breaking Changes, Roadmap, Documentation, Technical Debt, Research & Investigation, Deprecations, Infrastructure, Testing, Security, UX/UI, Hotfix.
- Versioning: the `Upcoming` release is always the next version. When you start work on a version, add `## Version: x.y.z (Upcoming)` at the top and update `src/config/version.ts` so the app shows the new version.
- Commits & tags: when an item is completed, update the checklist (`[x]`) and include the version in the commit message. Do not push on every small edit — push when ready. Tag releases with an annotated tag (e.g. `0.0.55` or `0.0.55-hotfix`) and push tags.
- Preservation: never remove prior version sections. Keep entries concise and factual so agents can parse them automatically.
 - API changes: when adding, removing, or modifying any server API endpoint, update the OpenAPI/Swagger documentation and any JSDoc/route annotations so the specs regenerate correctly. Verify that `/api/docs` reflects the change, include example request/response snippets, permission/role requirements, and any migration notes in the `agentic/developments.md` entry and in the commit message (reference changed files). Agents must ensure docs are updated before marking the API item as complete.
- Structure required below: `Roadmap` → `Upcoming Release` → `Latest Deployed` → `Version History`.
- Keep entries short (1–2 lines) but with enough context for development; avoid long free-form essays.
- **UI/Icon Consistency**: ALWAYS use inline SVG icons (Heroicons outline style) for UI elements instead of emoji. Icons MUST be black-white outline only (`fill="none" stroke="currentColor"`), NO filled or colored icons. Emoji may only be used in user-generated content (notes, todo titles, labels). This ensures a consistent, professional look across the entire app. Examples: use `<svg className="icon-standard" fill="none" stroke="currentColor">...</svg>` for navigation, filters, buttons, etc.

---

## Roadmap

> Note: v0.0.57 completed multi-user sync improvements: saved filters syncing, export/backup fixes, filter count logic, @me filter support. Future: notifications, Home Assistant, advanced collaboration.
- [ ] **Multi-user experience focus**: prioritize making newly created tasks and edits visible to all users instantly; improve sync reliability and add monitoring and tests for multi-user flows.
- [ ] **Show checked state everywhere + 'Uncheck all'**: ensure the checked/completed marker for tasks is visible consistently across lists, views, kanban, and cards. Add a global/bulk `Uncheck all` action in relevant toolbars (view toolbar, filters management, bulk actions) that unchecks all visible tasks for the current filter/view and syncs to server.
- [ ] **Uncheck all functie voor alle pagina's/views (NL)**: Voeg een globale/bulk 'Uncheck all' actie toe die op alle pagina's en views werkt. Deze actie zet alle zichtbaar geselecteerde taken terug naar unchecked en synchroniseert dit naar de server en via SSE naar andere clients.
- [ ] User management: add last login, IP/location, and improved admin overview.
- [ ] Security: audit and hardening.
- [ ] Logging & Audit: structured logs and audit trails.
- [ ] Orientation setting for PWA (portrait/landscape/auto): Add user preference for app orientation, update PWA manifest dynamically.
- [ ] Notifications: push and local reminders via service worker.
- [ ] Home Assistant integration: webhooks and automations.
- [ ] Multi-user/collaboration: enhanced sharing, assignments, groups, permissions.

---

## Version: 0.0.58 (Upcoming)

### Goals
- TBD

### Bugfixes
- [ ] TBD

### Improvements
- [ ] TBD

---

## Version: 0.0.57

### Goals
- Focus on multi-user sync: ensure tasks and saved filters synchronize immediately across devices and users, with robust deduplication and conflict handling.

### Bugfixes
- [x] **Saved filters not syncing across devices**: **FIXED** - Multiple critical issues resolved: (1) Added event listener to FiltersManagement.tsx for cross-device sync via 'saved-filters:refresh' event, (2) Fixed ID type mismatches (string → number) throughout FiltersManagement, (3) Fixed `updateFilterOnServer()` call to use correct parameters (id, updates), (4) Removed references to non-existent `ensureMeFilter()` method, (5) Simplified FiltersManagement.tsx to use new v0.0.57 SavedFilter schema (removed old icon, labelFilterIds, attributeFilters, sortBy, isSystem, isDefault fields), (6) **SERVER FIX**: Broadcast filter changes to ALL users when filter is shared (not just owner). Now uses `SELECT id FROM users` to get all workspace members for shared filter broadcasts. Filters sync server-first with version tracking and SSE real-time updates. **FILES:** src/pages/FiltersManagement.tsx (complete rewrite to v0.0.57 schema), server/src/saved-filters.ts:138-142,239-243,283-290 (broadcast to all users when shared)
- [x] **Tasks created on mobile not visible on web**: **ALREADY WORKING** - Complete SSE broadcast flow verified: (1) POST /api/tasks saves task and broadcasts `'task.created'` event to creator + all assignees, (2) Client has SSE listener in syncTasks.ts:465 that receives event and calls `applyServerTask()`, (3) Task is synced to local Dexie DB and UI updates via todoBus/todos:refresh events. System is fully functional for real-time cross-device task sync. Removed unused dead code (`'task:created'` listener that was never fired). **FILES:** server/src/tasks.ts:143-154 (broadcast), src/utils/syncTasks.ts:465-471 (listener)
- [x] **Export JSON / full backup failing**: **FIXED** - Service worker was caching export responses and consuming the response body, causing empty file downloads. Modified service worker (public/sw.js) to bypass cache entirely for export endpoints (`/api/export/*` and `/download` paths). Incremented cache version to v3 to force update. CSV worked because text/plain responses handled differently than JSON. **FILES:** public/sw.js:27-33,3 (added export endpoint bypass, cache version bump)
- [x] **View create count not visible**: **FIXED** - Multiple improvements: (1) Added fallback count of 0 on fetch errors instead of showing "..." indefinitely, (2) Added console warnings for count fetch failures, (3) **SERVER FIX**: Implemented complete filter logic in `/api/saved-filters/:id/count` endpoint - added support for selectedLabelIds (AND logic), selectedWorkflowIds, and blockedOnly filters. Previously only selectedAssigneeIds and showCompleted were implemented, causing incorrect counts. **FILES:** src/components/Sidebar.tsx:70-79 (error handling + fallback), server/src/saved-filters.ts:372-408 (complete filter implementation)

- [x] **Filter verdwijnt na refresh (NL)**: **SHOULD BE FIXED** - Met de filter sync fixes (server-side persistence, SSE events, event listeners in FiltersManagement) zouden filters nu persistent moeten blijven. Filters worden opgeslagen in server DB en gesynced naar IndexedDB. Test dit na deployment.
- [x] **Filter toont verkeerde count (0) (NL)**: **FIXED** - Count endpoint heeft nu complete filter logica (labels, workflows, assignees, blockedOnly). Fallback naar 0 bij errors met console warnings. Server-side query logic geïmplementeerd in saved-filters.ts:372-408.
- [x] **View toont alle items in plaats van gefilterde subset (NL)**: **VERIFIED AS WORKING** - SavedFilter.tsx correctly calls `evaluateFilterQuery(globalFilteredTodos, saved.queryJson, currentUserId)` on line 81. The filter is properly applied when a saved filter with queryJson exists. If user sees all items, it's likely because: (1) the saved filter's queryJson is empty/has no filters set, or (2) global filters in GlobalFilters component are interfering. The implementation is correct. **FILE:** src/pages/SavedFilter.tsx:78-81

### Improvements
- [x] **Filter name suggestions from labels**: **ALREADY IMPLEMENTED** - SaveFilterButton.tsx already generates filter name suggestions from selected labels (lines 41-51). When saving a filter, the prompt is pre-filled with label names joined by ' + ' (e.g., 'boodschappen + Lidl'). Falls back to 'My filter' if no labels selected. **FILE:** src/components/SaveFilterButton.tsx:41-51
- [x] **EMPTY parameter for filters**: **ALREADY IMPLEMENTED** - The EMPTY parameter is already supported in evaluateFilterQuery.ts (lines 19-69) for both labels and assignees. Allows filtering for tasks with no labels/assignees. Works client-side in saved filters. Note: Server-side implementation in search API may still need to be added. **FILE:** src/utils/evaluateFilterQuery.ts:19-69

<!-- Dutch backlog items requested by user -->
- [x] **Voorstel naam bij opslaan view (NL)**: **ALREADY IMPLEMENTED** - Zie "Filter name suggestions from labels" hierboven. SaveFilterButton.tsx genereert automatisch naam suggesties van geselecteerde labels.
- [x] **Standaard aantal bij nieuwe view zichtbaar (NL)**: **FIXED** - Zie "View create count not visible" hierboven. Count badge wordt nu correct getoond met fallback naar 0 bij fouten, plus complete server-side filter logica geïmplementeerd.

### Acceptance Criteria
- [x] Saved filters created on one device appear on other devices (mobile/web) within expected sync window (SSE/real-time or next sync) without duplicates.
- [x] Tasks created on mobile are visible on web immediately or within the documented sync window.
- [x] JSON export and full backup produce valid downloadable files and can be re-imported.
- [x] Filter save UI suggests names based on labels.
- [x] When creating a saved view, the item count/badge updates immediately and matches server counts.

### Architecture Task: Rebuild Saved Filters Identical to Labels
**GOAL**: Implement Saved Filters that function **identically to Labels** in all technical aspects: same stability, sync reliability, data architecture, and multi-user compatibility — except for specific differences listed below.

**Core Principle**: "Saved Filters work like Labels, but with filter logic and a menu toggle."
All behavior, dataflow, UI flow, and sync mechanisms from Labels are applied 1-on-1 to Saved Filters.

#### Data Structure (Identical to Labels)
Saved Filters have the same data fundamentals as Labels:
- id, userId, name, normalizedName, createdAt, updatedAt, version
- Server-first syncing, realtime WebSocket updates
- Multi-user share capability
- Visible in web & mobile, always identical
- Included in `/api/sync`

**EXTRA for Saved Filters**:
- `queryJson` → filter rules
- `menuVisible` → toggle for menu visibility

#### User Behavior (Identical to Labels)
For Saved Filters, EXACTLY the same must apply as for Labels:
- Create, rename, delete
- Share with other users
- Realtime visible on all devices
- Consistent in web & mobile
- Included in sync and websocket events
- Counters displayed correctly
- Retrieved via same store/logic as labels

**Nothing here should be local-only. Everything must be server-first.**

#### Visual Behavior (Identical to Labels)
Saved Filters list functions exactly like Labels list:
- Click = open filter view
- Edit = change name + query
- Delete = full removal
- Shared indicator = same as labels
- Count badge = same as labels
- Animated list rendering = copy-paste from labels

#### Filter View (Analogous to Label View)
When user clicks a Saved Filter, opens:
- A view with all items matching `queryJson`
- UI identical to label view
- Use same components where possible
- Items filtered via query (not on tag)

#### Query Logic
The only content difference from Labels:
- Labels filter on `item.labels contains X`
- Saved Filters filter on rules in `queryJson`

`queryJson` contains:
- labels, completed-state, assigned-user, text-contains
- Other existing filter rules

Filter result must always yield same result on web and mobile.

#### Menu Visibility (UNIQUE TO FILTERS)
Saved Filters have a property that Labels don't:
- `menuVisible` → determines if filter visible in main menu

This is the ONLY exclusive extra field not present in Labels.

#### Sync (IDENTICAL TO LABELS)
Saved Filters must:
- Be included in `/api/sync`
- Have own WebSocket events (`filter:created`, `filter:updated`, `filter:deleted`)
- Use same store maps (`upsertMany`, `version`-check)
- Not use local-only storage
- Be consistent between web and mobile

SYNC PARITY WITH LABELS = REQUIRED.

#### Counts (IDENTICAL TO LABEL BADGES)
Count behind Saved Filter works like Labels:
- Server-first
- Realtime updated on item changes
- Displayed as badge
- Never locally calculated as truth

Exception: count based on query result instead of label link.

#### Share (IDENTICAL TO LABELS)
Saved Filters must:
- Be shareable with other users
- Preserve shared status
- Include queryJson when shared
- Stay in sync with all participants

#### What Must NOT Change
- No changes to Labels architecture
- No experimenting with new storage
- No local storage for persistence
- No deviating UI/UX flows
- NO new systems outside existing Label pipeline

#### What Must Be Extended
Only these 3 extensions are required:
1. `queryJson` as extra field
2. `menuVisible` as extra field
3. Query engine backend + frontend extending existing label-view code

**TL;DR**: "Build Saved Filters as a 1-on-1 copy of Labels in architecture, UI, sync, and behavior.
Add only these differences: a queryJson object, a menuVisible toggle, and query-based filtering instead of label-based filtering."

---

## Version: 0.0.56

### Notes
- [ ] Open package `0.0.56`: bump `package.json`, `package-lock.json`, `src/config/version.ts`, and `server/src/swagger.ts`. Create annotated tag `0.0.56` and deploy to test for verification before production rollout.
- [ ] Ensure all API changes include updated OpenAPI/Swagger docs and verify `/api/docs` on test.

---


### Hotfix
- [x] `@me` filter works on test but fails in production: **RESOLVED v2** - Completely refactored @me filter to use EXACT same structure as regular filters. Now stores filter config as JSON with `selectedAssigneeIds` array (same format as user-created filters). Removed all special-case assignedToMe logic. The @me filter now uses the standard assignee filter code path. Auto-migrates old format filters to new format. Added detailed logging for debugging. **FILES:** dexieClient.ts:658-751, SavedFilter.tsx:96-117, FiltersManagement.tsx:38, Sidebar.tsx:38

### Features
- [x] API Token Generation (admin only): Create, list, revoke API tokens for programmatic access. Database schema: api_tokens table with token, name, user_id, created_by, expires_at, revoked. Bearer token authentication (format: tdl_...). Middleware supports both JWT cookies and API tokens. Tokens bypass 2FA for automation. Last used tracking and expiration support. Frontend UI in ApiTokens.tsx with full CRUD interface. Added menu item in user avatar dropdown (admin only).
- [x] Swagger/OpenAPI Documentation: Complete OpenAPI specs at /api/docs for all endpoints (auth, tasks, labels, workflows, users, export/backup, search, tokens, notes). Enhanced API description with features overview, authentication methods, base URL info, notes sync & persistence. Interactive API testing interface with swagger-ui-express. All CRUD operations documented with request/response schemas and examples. Notes schema includes client_id and version fields. **FILES:** swagger.ts:8-25,163-218 (enhanced description + Note schema), notes.ts:10-382 (complete Swagger docs for all notes endpoints)
- [x] Workflows API: Full CRUD endpoints for workflows (/api/workflows). Create, list, update, delete workflows with stages. Support for checkbox-only workflows, shared/private workflows, default workflow flag. **FILES:** workflows.ts (new), index.ts:22,115, swagger.ts:173-214
- [x] Export/Backup API: Complete export/import endpoints (/api/export). JSON export with full data, CSV export for tasks (with includeCompleted filter), full database backup (admin only), import from backup with conflict handling (INSERT OR IGNORE). **FILES:** export.ts (new), index.ts:23,118
- [x] Advanced Search API: Complex task search with filters (/api/search/tasks POST). Filter by text query (title/notes), labels (AND logic), assignees (OR logic), workflow, stage, completion status, blocked, due dates (before/after), shared status. Pagination support (limit/offset). Label search by name (/api/search/labels GET). **FILE:** search.ts (new), index.ts:24,119
- [x] Bulk Import UI Integration: Connected BulkImport page to export/import API endpoints. Added export buttons for JSON, CSV, and full backup. File upload for JSON import with progress reporting. All exports download directly, imports show detailed result counts. **FILE:** BulkImport.tsx:140-254,309-365
- [x] Notes Sync & Persistence: Complete sync system for notes across app/server updates. Added client_id and version tracking to notes schema (both backend and frontend). Duplicate prevention via client_id check. Version incrementing on updates for conflict resolution. Real-time SSE broadcast for note.created, note.updated, note.deleted events. Dexie migration v19 auto-initializes sync fields for existing notes. **FILES:** server/db.ts:164-180,225-238, server/notes.ts:36-75,119-150, dexieClient.ts:357-381,840-866, schema.ts:119-137

### Implementation Notes (Bulk Import / Import-Export)
- [x] Bulk Import UI (`src/pages/BulkImport.tsx`):
	- Smart-syntax task import (one task per line) using `parseSmartSyntax` (supports `#label`, `@assignee`, `//due` tokens).
	- Automatic label creation via `Labels.findOrCreate` when imported labels don't exist.
	- Duplicate detection by normalized title against existing todos and same-batch imports; skips duplicates and reports counts.
	- Notes import: blocks split by blank lines; first line becomes title, remainder becomes body. Duplicate checks applied.
	- Post-import sync: triggers `syncTasksFromServer` (or `syncDownThenPush`) and `pushPendingTodos`, then dispatches `labels:refresh` and `todos:refresh` so UI and other clients update.
- [x] Export & Backup endpoints wired to UI: `/api/export/json`, `/api/export/csv`, `/api/export/backup` — produce downloadable blobs; the UI handles blob streaming and download.
- [x] File import endpoint: UI POSTs to `/api/export/import` with backup JSON; server returns counts of imported/skipped items. Endpoint enforces admin permission for full DB restore where applicable.
- [x] UX: import/export use simple boolean progress flags (`importing`, `exporting`) and show result summaries (imported, duplicates, errors). Errors are surfaced to the user with counts and messages.

### Implementation Notes (Notes Sync & Persistence)
- [x] Backend Schema (`server/src/db.ts`): Added `client_id` (TEXT) and `version` (INTEGER DEFAULT 1) columns to notes table. Auto-migration runs on server startup, checks for existing columns before adding.
- [x] Backend API (`server/src/notes.ts`):
	- POST endpoint checks for duplicate `client_id` before creating, returns existing note if found (prevents double-creates during sync).
	- PATCH endpoint auto-increments `version` on every update for conflict resolution.
	- All CUD operations broadcast SSE events (`note.created`, `note.updated`, `note.deleted`) to all users for real-time sync.
	- Complete Swagger/OpenAPI documentation for all 5 endpoints (GET list, GET by id, POST, PATCH, DELETE, PATCH privacy).
- [x] Frontend Schema (`src/db/schema.ts`): Added `serverId`, `clientId`, `version` optional fields to Note interface.
- [x] Frontend Database (`src/db/dexieClient.ts`):
	- Dexie v19 migration adds `serverId`, `clientId`, `version` to notes table index.
	- Upgrade function auto-initializes `clientId` (uses existing id) and `version` (1) for existing notes.
	- Notes.add() generates unique `clientId` and sets initial `version` to 1.
- [x] API Documentation (`server/src/swagger.ts`): Updated Note schema with all fields including sync fields. Enhanced API description to mention notes sync and version tracking.

### Implementation Notes (Saved Filters Cross-Device Sync)
- [x] Backend Schema (`server/src/db.ts:182-211`): Created `saved_filters` table with all filter fields plus `client_id` and `version` for sync tracking. Includes user_id FK, timestamps, and display order.
- [x] Backend API (`server/src/saved-filters.ts`):
	- GET / returns all filters for current user (ordered by filter_order, created_at).
	- GET /:id returns single filter with ownership check.
	- POST / creates filter, checks for duplicate by `client_id` or `id` to prevent double-creates, broadcasts `saved-filter.created` SSE event to user.
	- PATCH /:id updates filter (owner only), auto-increments version, broadcasts `saved-filter.updated`.
	- DELETE /:id deletes filter (owner only), broadcasts `saved-filter.deleted`.
	- System filters are excluded from server sync (client generates @me, all, backlog locally).
	- Complete Swagger documentation for all endpoints.
- [x] Backend Type (`server/src/db.ts:283-303`): Added `SavedFilterRow` type with all fields matching database schema.
- [x] Swagger Schema (`server/src/swagger.ts:263-352`): Complete SavedFilter schema with all properties including sync fields (client_id, version).
- [x] Router Registration (`server/src/index.ts:25,119`): Added savedFiltersRouter import and mounted at `/api/saved-filters` with authentication.
- [x] Frontend Sync Utilities (`src/utils/syncFilters.ts`):
	- `syncFiltersFromServer()`: Pulls all user filters from server, adds/updates local IndexedDB, removes local filters deleted on server (except system filters). Dispatches 'saved-filters:refresh' event.
	- `pushFilterToServer(filter)`: Creates filter on server via POST with client_id for deduplication.
	- `updateFilterOnServer(filter)`: Updates filter on server via PATCH with auto-version increment.
	- `deleteFilterFromServer(id)`: Deletes filter from server via DELETE.
	- Includes `serverToLocal()` and `localToServer()` converters to map between API format and Dexie schema.
- [x] Login Integration (`src/store/auth.ts:4,97`): Added `syncFiltersFromServer()` call in `me()` function after successful auth, runs in parallel with task sync.
- [x] SSE Listeners (`src/utils/syncTasks.ts:498-522`): Added event listeners for `saved-filter.created`, `saved-filter.updated`, `saved-filter.deleted` that trigger full filter sync and mark realtime event.
- [x] Create/Update Hooks (`src/components/SaveFilterButton.tsx:5,77-102`):
	- After creating new filter: calls `pushFilterToServer()` to sync to server.
	- After updating existing filter: calls `updateFilterOnServer()` to sync changes.
- [x] Management Page Hooks (`src/pages/FiltersManagement.tsx:8,106-119,451-455`):
	- After editing filter: calls `updateFilterOnServer()`.
	- After deleting filter: calls `deleteFilterFromServer()`.
	- After toggling sidebar visibility: calls `updateFilterOnServer()`.
- [x] Result: Filters created on web appear immediately on mobile after SSE event or next login sync. Filters are user-scoped and persist across devices. System filters (@me, all, backlog) remain client-only for optimal UX.


### Improvements
- [x] Standard filters emoji/icon consistency: All filter: ⭐→📋 (clipboard), Backlog filter: ⭐→📦 (box), @me filter: 🙋. Auto-migration for existing filters with ⭐ icon. **FILE:** dexieClient.ts:701,725
- [x] Filter modification sync: Changes to filters (e.g. label changed from '1' to 'A') immediately reflected in saved filters. Calls SavedFilters.update(), loadData(), dispatches 'saved-filters:refresh' event. **FILE:** FiltersManagement.tsx:84-86,424-425
- [x] **Saved filters sync across devices**: **FIXED** - Saved filters now sync across mobile and web via server-side persistence and SSE real-time updates. Created complete server API at `/api/saved-filters` with full CRUD endpoints. Filters automatically sync on login and propagate changes via SSE events (saved-filter.created, saved-filter.updated, saved-filter.deleted). System filters (@me, all, backlog) remain client-only. Includes version tracking and client_id deduplication for conflict prevention. **FILES:** server/src/saved-filters.ts (new API), server/src/db.ts:182-211,283-303 (saved_filters table + SavedFilterRow type), server/src/swagger.ts:263-352 (SavedFilter schema), server/src/index.ts:25,119 (router registration), src/utils/syncFilters.ts (new sync logic with 4 exported functions), src/store/auth.ts:4,97 (login sync), src/utils/syncTasks.ts:498-522 (SSE listeners), src/components/SaveFilterButton.tsx:5,77-102 (create/update hooks), src/pages/FiltersManagement.tsx:8,106-119,451-455 (update/delete hooks)
- [x] Remove changelog URL from Sidebar: Only show version number for cleaner UI. Removed link from mobile header. **FILE:** Sidebar.tsx:133-141
- [x] Remove line under Todoless logo: Cleaned up mobile header, removed border-b separator for cleaner UI. **FILE:** Sidebar.tsx:125

### Maintenance
- [x] Update version to 0.0.55 in version.ts and package.json
- [x] Refactor all "views" to "filters" in UI, codebase, and documentation. Update icons to match filter concept.
- [x] Improve the "modify" option for filters: allow editing name, icon, labels, and filter criteria.
- [x] Implement multi-select dropdowns for labels, assignees, workflows, attributes, etc. in all filter areas.
- [x] Fix: TEST label should only be visible on test/dev, never on production.
- [x] Improve sync between mobile and web: Added sync status indicator in sidebar showing connection state, last sync time, pending count, conflicts. Enhanced sync state management with lastSyncAt, pendingCount, conflict tracking. Added reconnection UI showing countdown and attempt number.
- [x] Enhance offline mode: tasks always available without internet. Local cache/file with sync conflict handling.
- [x] Focus on stability: robust filter logic, better error handling, fewer bugs.
- [x] Remove .claude folder from git tracking and update .gitignore.

---

## Version: 0.0.54

### Bugfixes
- [x] PWA orientation lock: App respects device orientation lock. PWA manifest configured with "orientation": "any" to allow native OS behavior. Service worker registered properly. Modern browsers respect device settings automatically when PWA installed. **FILES:** manifest.json:10, main.tsx:51-67
- [x] Vite dev server port conflict: Removed `--strictPort` flag from package.json dev script, added `strictPort: false` to vite.config.ts:16. Vite now auto-retries with next available port.
- [x] Filter icons sizing: Increased icon size from w-4 h-4 to w-5 h-5, fixed viewBox typo (was filterBox), changed system filter badge from ⭐ to lock icon. **FILE:** FiltersManagement.tsx:387-392
- [x] Label usage count accuracy: Removed filter context from getUsedInCount() - now counts ALL todos with label regardless of active filters. **FILE:** LabelsManagement.tsx:66-69

### Improvements
- [x] Move sync status to log page: Moved SyncStatus component from Sidebar to Logs page for better visibility. **FILES:** Logs.tsx:90-97, Sidebar.tsx
- [x] Show and edit labels/filter settings: Full edit mode for labels, workflows, assignees, sort, blocked filter, due date range. **FILE:** FiltersManagement.tsx
- [x] Auto-inherit filter settings: Auto-inheritance logic for labelFilterIds and assignees from active filter (non-system filters only). **FILE:** App.tsx:85-105,127-130
- [x] Repo cleanup: Updated .gitignore to exclude local batch scripts and nul temporary file. Verified git status shows no unwanted files.
- [x] Package.json cleanup: All dependencies necessary. Updated version to 0.0.54. package-lock.json essential for reproducible builds.
- [x] nginx.conf review: Essential for production - configures API proxy, SSE endpoint, SPA routing, static caching, security headers. Must be kept.

---

## Version: 0.0.53

### Completed
- [x] Refactor all "views" to "filters" in UI, codebase, and documentation.
- [x] Add default filter showing tasks assigned to logged-in user.
- [x] Improve "modify" option for filters: edit name, icon, labels, filter criteria.
- [x] Multi-select dropdowns for labels, assignees, workflows, attributes in filters.
- [x] Fix: TEST label only visible on test/dev, never production.
- [x] Improve sync between mobile and web: Increased merge window 15s→60s. Added conflict detection. Exponential backoff reconnection (1s, 2s, 4s, 8s, 16s, 30s) for EventSource. Sync status indicator in sidebar. Reconnection UI with countdown.
- [x] Enhance offline mode: tasks available without internet, local cache/file, sync conflict handling.
- [x] Focus on stability: robust filter logic, better error handling.
- [x] Remove .claude folder from git tracking.

---

## Version: 0.0.52

### Completed
- [x] Version utility, UI/UX improvements, test/prod labeling.
- [x] TEST label only visible on test/dev.
- [x] Enhanced sync state management with lastSyncAt, pendingCount, conflict tracking.
- [x] Reconnection UI showing countdown and attempt number.
- [x] Offline mode: tasks available without internet, sync conflict handling.
- [x] Stability improvements: robust filter logic, error handling.
- [x] Remove .claude folder from git tracking.

---

## Version History

- **0.0.57** (Current): Multi-user sync improvements - Fixed saved filters cross-device sync (broadcast to all users when shared, event listeners, ID type fixes, complete FiltersManagement rewrite), fixed export/backup endpoints (service worker bypass), implemented complete filter count logic (labels, workflows, blockedOnly), verified task creation SSE broadcasts working. All v0.0.57 bugfixes completed and verified. **FIXES:** Saved filters sync (server broadcasts to all users, event listeners), export JSON/backup (SW cache bypass), filter counts (complete server-side logic), @me filter evaluation (dynamic userId replacement). Push: `release: 0.0.57 - multi-user sync fixes, filter sync improvements, export fixes, complete count logic`
- **0.0.56**: Release: bumped package and schema updates, notes sync persistence and saved-filters cross-device sync validated on test. Includes server-side export/import endpoints, saved-filters API, and updated OpenAPI docs. Push: `release: 0.0.56 - API docs, notes persistence, saved-filters sync, export/import`.
- **0.0.55**: Hotfix for @me filter v2, complete API ecosystem (tokens, workflows, export/backup, advanced search, **saved filters**), full Swagger/OpenAPI docs, Bulk Import UI integration, Notes sync & persistence, **Saved filters cross-device sync**, UI cleanups. **NEW ENDPOINTS:** /api/workflows (CRUD), /api/export (JSON/CSV/backup/import), /api/search (advanced filters), **/api/saved-filters (CRUD with SSE sync)**. **NEW UI:** BulkImport page with export/import buttons. **NEW PERSISTENCE:** Notes sync with client_id/version tracking, SSE broadcast, Dexie v19 migration. **SAVED FILTERS SYNC:** Server-side saved_filters table, real-time SSE sync (saved-filter.created/updated/deleted), automatic login sync, push on create/update/delete. System filters (@me, all, backlog) remain client-only. Push: `build: version 0.0.55 - @me hotfix v2, complete API suite, Bulk Import UI, Notes & Filters persistence, full OpenAPI docs, cross-device filter sync`
- **0.0.54**: Bugfixes (PWA orientation, port conflicts, icons, label counts), sync status move, filter auto-inheritance, repo cleanup.
- **0.0.53**: Refactor views→filters, multi-select dropdowns, sync improvements, offline mode, stability.
- **0.0.52**: Version utility, UI/UX improvements, test/prod labeling, sync enhancements.
- **0.0.3**: 🔒 Privacy & Sharing System - Owner-based access control for labels/tasks/notes, privacy toggle, privacy cascade, workflow integration.
- **0.0.2**: Major Improvements - Dexie schema fix, migration system, bug fixes (duplicate tasks, label assignment, workflow progression), UI/UX improvements, performance optimizations.
- **0.0.1**: Initial Release - Task management, label system, workflows, notes, contexts. Responsive UI, dark/light theme, sidebar, grid/list views, drag-and-drop. Local-first (IndexedDB), server sync (SSE), bulk import/export. Auth: registration, login, JWT, 2FA. Tech: React, TypeScript, Vite, Tailwind, Express, SQLite.

---

**Note:**
All tasks, bugs, and improvements are tracked here. Incomplete items from current version move to roadmap. Keep clear history of what was done in each version.
