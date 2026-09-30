/// <reference path="../pb_data/types.d.ts" />

// Security hardening (mobile/PWA go-live audit): two native read rules were
// wider than the data they guard.
//   - agent_audit_log: any signed-in user could list the audit log of EVERY
//     user (ip_address, agent_key_id, details). The admin route
//     GET /api/agent/audit-log already scopes to the caller; the native API
//     now matches it (own rows only).
//   - families: any signed-in user could enumerate every family (id, name,
//     created_by) across tenants. Now only the caller's own family.
// Both keep the GH#98 member_status guard. Idempotent (GH#34): rules are set
// to fixed strings, so re-running is a no-op.
const STATUS_GUARD = '@request.auth.member_status != "blocked" && @request.auth.member_status != "pending_approval"';

const SCOPED_READS = {
  agent_audit_log: `(user = @request.auth.id) && ${STATUS_GUARD}`,
  families: `(id = @request.auth.family_id) && ${STATUS_GUARD}`,
};

const PREVIOUS_READS = {
  agent_audit_log: `(@request.auth.id != "") && ${STATUS_GUARD}`,
  families: `(@request.auth.id != "") && ${STATUS_GUARD}`,
};

function setReadRules(app, rules) {
  for (const name of Object.keys(rules)) {
    try {
      const col = app.findCollectionByNameOrId(name);
      if (!col) continue;
      if (String(col.listRule ?? '') === rules[name] && String(col.viewRule ?? '') === rules[name]) continue;
      col.listRule = rules[name];
      col.viewRule = rules[name];
      app.save(col);
    } catch (_) {
      // Collection does not exist at this migration point — skip.
    }
  }
}

migrate(
  (app) => setReadRules(app, SCOPED_READS),
  (app) => setReadRules(app, PREVIOUS_READS)
);
