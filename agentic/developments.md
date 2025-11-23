# Todoless Development Tracker

---
**Default Instruction:**
**Standard Template & Categorization Instruction:**
- All new development items must be categorized using the following template:
  - **Features**
  - **Improvements**
  - **Bugfixes**
  - **Maintenance**
  - **Breaking Changes**
  - **Roadmap**
  - **Documentation**
  - **Technical Debt**
  - **Research & Investigation**
  - **Deprecations**
  - **Infrastructure**
  - **Testing**
  - **Security**
  - **UX/UI**
  - **Hotfix**
- When adding a new item, start with `#file:developments.md` and your item. The agent will determine the correct category; if the category does not exist in the current version, it will be added automatically.
- All instructions and templates must appear above the ROADMAP section.
- Each version must clearly separate categories and items, with a line between the UPCOMING version and its items/categories, and between previous versions.
- Each version in the history must be visually separated by a line for clarity.
- When a feature, fix, or improvement is implemented and pushed, mark it as completed (`[x]`) and reference the version in the commit message.
- Tasks not completed in the current version are automatically carried over to the next **Upcoming** version.
- [ ] Task Import/Export/Backup API: Endpoints for exporting/importing tasks and notes (JSON/CSV). Full/partial backup and restore.
- [ ] Notification API: Endpoints to manage push/local notifications, reminders, and notification settings per user/device.
- [ ] Home Assistant Integration API: Webhook endpoints for smart home triggers. API for syncing tasks with Home Assistant automations.
- [ ] API Token Management: Endpoints for generating, revoking, and listing personal API tokens.
- [ ] Contact/Test Endpoints: Dedicated endpoints for integration testing, health checks, and mock responses.
- [ ] Advanced Filtering & Search API: Endpoints for complex queries, filtering by label, date, assignee, etc.
---

## Version: 0.0.55 (Upcoming)

### Hotfix
- [x] `@me` filter works on test but fails in production: **RESOLVED v2** - Completely refactored @me filter to use EXACT same structure as regular filters. Now stores filter config as JSON with selectedAssigneeIds array (same format as user-created filters). Removed all special-case assignedToMe logic. The @me filter now uses the standard assignee filter code path (lines 106-117 in SavedFilter.tsx). Auto-migrates old format filters to new format. Added detailed logging for debugging. **HOTFIX 0.0.55 - FIXED v2**

#### Changes Made (v2)
- [x] dexieClient.ts ensureMeFilter(): Now creates filter with `attributeFilters.filters = JSON.stringify({ selectedAssigneeIds: [currentUserId], ... })` - exact same format as regular filters
- [x] SavedFilter.tsx: Removed special assignedToMe handling (lines 97-98), @me now flows through standard selectedAssigneeIds filter logic
- [x] Added migration logic: Automatically converts old @me filters to new standard format
- [x] Enhanced logging: Console logs show filter name and matched todos for @me filter debugging


### Major Features
- [ ] More API endpoints: Expand backend API and add a Swagger/OpenAPI documentation page for easy testing and integration.

- [x] Update version to 0.0.55 in version.ts and package.json
- [x] Install Swagger/OpenAPI dependencies (swagger-jsdoc, swagger-ui-express)
- [x] Setup Swagger documentation endpoint at /api/docs
- [x] Document core API endpoints with OpenAPI specs (auth, tasks, labels, users, logs)
- [x] API Token Generation (admin only): Create, list, revoke API tokens for programmatic access
  - Database schema: api_tokens table with token, name, user_id, created_by, expires_at, revoked
  - Bearer token authentication: Authorization header support (format: tdl_...)
  - Middleware update: requireAuth now supports both JWT cookies and API tokens
  - Tokens bypass 2FA requirement for automation use cases
  - Last used tracking and expiration support
- [x] Create frontend UI for API token management (admin panel)
  - New page: src/pages/ApiTokens.tsx with full CRUD interface
  - Added menu item in user avatar dropdown (admin only)
- [ ] Add setting to choose app orientation (portrait, landscape, or auto). Useful for wall-mounted tablets or kiosk setups. Should update PWA manifest and apply orientation lock dynamically based on user preference.
- [x] Edit, delete, and lock icons in the filter section are not the correct size and are hard to read. Fix icon sizing and clarity. **FIXED:** Increased icon size from w-4 h-4 to w-5 h-5, fixed viewBox typo (was filterBox), changed system filter badge from ⭐ to lock icon (FiltersManagement.tsx:387-392)

### Improvements
- [x] Standard filters should always have an emoji/icon for visual consistency. Add missing emojis to all default filters. **FIXED:** All filter: ⭐→📋 (clipboard), Backlog filter: ⭐→📦 (box), @me filter: 🙋 (maintained). Auto-migration added for existing filters with ⭐ icon (dexieClient.ts:701,725)
- [x] When a filter is modified (e.g. label changed from '1' to 'A'), the change should be immediately reflected in the saved filters. Ensure saved filters always stay in sync with user modifications. **FIXED:** Already implemented in FiltersManagement.tsx:84-86,424-425 - calls SavedFilters.update(), loadData(), and dispatches 'saved-filters:refresh' event
- [x] Remove changelog URL behind version in Sidebar; only show version number for a cleaner UI. **FIXED:** Removed changelog link from mobile header, now shows only version number like desktop (Sidebar.tsx:133-141)
- [ ] Remove line under Todoless logo in Sidebar for version 0.55 and later. Clean up UI so only the logo and version are shown, with no separator line.

---

- [x] Refactor all "views" to "filters" in UI, codebase, and documentation. Update icons to match filter concept.
- [x] Improve the "modify" option for filters: allow editing name, icon, labels, and filter criteria.
- [x] Implement multi-select dropdowns for labels, assignees, workflows, attributes, etc. in all filter areas.
- [x] Fix: TEST label should only be visible on test/dev, never on production.
- [x] Improve sync between mobile and web for the same user:
  - Added sync status indicator in sidebar showing connection state, last sync time, pending count, and conflicts
  - Enhanced sync state management with lastSyncAt, pendingCount, and conflict tracking
  - Added reconnection UI showing countdown and attempt number
- [x] Enhance offline mode: tasks should always be available, even without internet. Use local cache/file and handle sync conflicts.
- [x] Focus on stability: robust filter logic, better error handling, fewer bugs.
- [x] Remove .claude folder from git tracking and update .gitignore.
## Version: 0.0.52
### Completed
- [x] Version utility, UI/UX improvements, test/prod labeling.
- [x] Fix: TEST label should only be visible on test/dev, never on production.
  - Enhanced sync state management with lastSyncAt, pendingCount, and conflict tracking
  - Added reconnection UI showing countdown and attempt number
- [x] Enhance offline mode: tasks should always be available, even without internet. Use local cache/file and handle sync conflicts.
- [x] Focus on stability: robust filter logic, better error handling, fewer bugs.
- [x] Remove .claude folder from git tracking and update .gitignore.
---

## Version History

- 0.0.55 (Upcoming): All new tasks, bugs, and improvements are tracked here until released. Push action: `build: frontend rebuild for version 0.0.55`
- 0.0.54: All new tasks, bugs, and improvements are tracked here until released. Push action: `build: frontend rebuild for version 0.0.54`
- 0.0.52: Version utility, UI/UX improvements, test/prod labeling. Push action: `feat: versie en env utility, bugfixes, changes map uitgesloten, instruction/bug notities lokaal`
- 0.0.3: 🔒 Major Feature: Privacy & Sharing System
    - Owner-based access control for labels, tasks, notes
    - Privacy toggle (shared/private) with visual indicators
    - Privacy cascade for labels/tasks/notes
    - Workflow integration with privacy
- 0.0.2: Major Improvements
    - Dexie schema fix, migration system, data integrity
    - Bug fixes: duplicate tasks, label assignment, workflow progression, context filtering, note pinning, UI rendering
    - UI/UX: loading states, error messages, mobile responsiveness, accessibility
    - Performance: optimized DB queries
- 0.0.1: Initial Release
    - Task management, label system, workflows, notes, contexts
    - Responsive UI, dark/light theme, sidebar, grid/list views, drag-and-drop
    - Local-first (IndexedDB), server sync (SSE), bulk import/export
    - Auth: registration, login, JWT, 2FA
    - Tech: React, TypeScript, Vite, Tailwind, Express, SQLite

---

**Note:**
- All tasks, bugs, and improvements are tracked here. If a task is not completed in the current version, it will be carried over to the next version.
- Use this file to check progress, plan releases, and keep a clear history of what was done in each version.
