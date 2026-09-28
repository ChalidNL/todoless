/// <reference path="../pb_data/types.d.ts" />

// GH#19: `api_tokens` has no autodate fields and `agent_audit_log.created`
// is a plain date field the hooks never set.
//
// - Migration 033 created `api_tokens` WITHOUT `created`/`updated` autodate
//   fields, so /api/api-tokens returned `created: null` and /api/agent/list
//   had to fall back to `new Date()` (every token looked "just now").
// - Migration 032 created `agent_audit_log` with `created` as a plain date
//   field; no hook ever wrote it, so the `-created` sort was meaningless.
//
// This migration adds real AutodateFields to both collections. PocketBase
// fills them automatically on record save (create and, for `updated`, update).
//
// NOTE: this is a NEW migration on purpose — editing 032/033 in place would
// trip PocketBase's applied-migration checksum tracking on upgraded installs
// (GH#34 convention, see 071_rotate_user_token_keys.js).
migrate(
  (app) => {
    const collections = ['api_tokens', 'agent_audit_log'];

    for (const name of collections) {
      let collection;
      try {
        collection = app.findCollectionByNameOrId(name);
      } catch {
        continue; // skip if collection doesn't exist (fresh-boot ordering)
      }

      let changed = false;

      let created = collection.fields.getByName('created');
      if (!created) {
        collection.fields.add(
          new AutodateField({
            name: 'created',
            onCreate: true,
            onUpdate: false,
          }),
        );
        changed = true;
      } else if (String(created.type) !== 'autodate') {
        // agent_audit_log: upgrade the plain date field to autodate so saves
        // populate it. Replace-in-place (same column name keeps indexes valid).
        collection.fields.removeById(created.id);
        collection.fields.add(
          new AutodateField({
            name: 'created',
            onCreate: true,
            onUpdate: false,
          }),
        );
        changed = true;
      }

      if (!collection.fields.getByName('updated')) {
        collection.fields.add(
          new AutodateField({
            name: 'updated',
            onCreate: true,
            onUpdate: true,
          }),
        );
        changed = true;
      }

      if (changed) {
        app.save(collection);
      }
    }
  },
  (app) => {
    // down: no-op — removing autodate fields is destructive and unnecessary.
  },
);