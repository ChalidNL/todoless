/// <reference path="../pb_data/types.d.ts" />

// Deleted-entries tombstone log for integration incremental sync (GH#102).
// Every hard-deleted task/grocery record is recorded here so that clients that
// poll `/api/entries` (or `/api/v1 {action:"list"}`) with `updated_since` and
// `include_deleted=1` can remove items that disappeared server-side.
//
// The collection is intentionally rule-less: it is only read/written from JS
// hooks (list endpoints + after-delete hooks). No direct collection API access
// is granted.

migrate(
  (app) => {
    const collection = new Collection({
      name: 'deleted_entries',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'ref_id', type: 'text', required: true },
        {
          name: 'kind',
          type: 'select',
          required: true,
          values: ['task', 'grocery'],
          maxSelect: 1,
        },
        { name: 'family_id', type: 'text', required: false },
        { name: 'user_id', type: 'text', required: false },
        {
          name: 'deleted_at',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
      ],
    });
    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('deleted_entries');
      app.delete(collection);
    } catch (_) {
      // already absent
    }
  },
);