/// <reference path="../pb_data/types.d.ts" />

// Owner-bound rules for three per-person collections:
// - app_settings: listRule was `@request.auth.id != ""`, so any member could
//   list every other user's settings row (viewRule was already owner-only).
// - goals / rewards: update/delete only required a session, so any member
//   could change or delete another member's goal or reward.
// Now only the record's own user may list/update/delete it; list/view keep
// the existing member-status gate (z068). Idempotent: rules are assigned,
// not appended. Down restores the previous rules.
const ACTIVE = '@request.auth.member_status != "blocked" && @request.auth.member_status != "pending_approval"';

const UP = {
  app_settings: { listRule: '(user = @request.auth.id) && ' + ACTIVE },
  goals: { updateRule: 'user = @request.auth.id && ' + ACTIVE, deleteRule: 'user = @request.auth.id && @request.auth.role != "child" && ' + ACTIVE },
  rewards: { updateRule: 'user = @request.auth.id && @request.auth.role != "child" && ' + ACTIVE, deleteRule: 'user = @request.auth.id && @request.auth.role != "child" && ' + ACTIVE },
};
const DOWN = {
  app_settings: { listRule: '(@request.auth.id != "") && ' + ACTIVE },
  goals: { updateRule: '@request.auth.id != ""', deleteRule: '@request.auth.id != "" && @request.auth.role != "child"' },
  rewards: { updateRule: '@request.auth.id != "" && @request.auth.role != "child"', deleteRule: '@request.auth.id != "" && @request.auth.role != "child"' },
};

function apply(app, rules) {
  for (const name of Object.keys(rules)) {
    let collection;
    try { collection = app.findCollectionByNameOrId(name); } catch (_) { continue; }
    if (!collection.fields.getByName('user')) continue;
    for (const key of Object.keys(rules[name])) collection[key] = rules[name][key];
    app.save(collection);
  }
}

migrate((app) => apply(app, UP), (app) => apply(app, DOWN));
