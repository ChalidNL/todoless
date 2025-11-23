Release v0.0.55

Summary
- Added requirement: any change to server API endpoints (add, modify, remove) must include updates to OpenAPI/Swagger documentation and JSDoc/route annotations. Verify `/api/docs` shows the change and include example request/response snippets, permission notes, and file references in the related commit message and `agentic/developments.md` entry.

Major Items
- Bulk Import / Import-Export: client-side Bulk Import UI (`src/pages/BulkImport.tsx`) supports smart-syntax task import, automatic label creation, duplicate detection, notes import, and post-import sync. Export endpoints `/api/export/json`, `/api/export/csv`, `/api/export/backup` are wired to the UI; import posts to `/api/export/import`.

Known Issues
- Saved filters sync (web ↔ mobile): custom saved filters created on web (example: "boodschappen") may not appear on mobile for the same user. Investigation and fix planned: ensure user-scoped schema, server sync, and `saved-filters:refresh` dispatching across clients.

Next Steps
1. Fix saved-filters web↔mobile sync and add automated tests.
2. Finalize server-side import/restore permissions and logging.
3. Verify `/api/docs` after every API change and publish release notes.

Files changed (docs):
- `agentic/developments.md` (instructions + release notes)
- `instruction.md` (project instruction)

Release actions
- Tag: `0.0.55-release`
- Recommended: publish GitHub release with these notes and attach changelog if available.
