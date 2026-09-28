/// <reference path="../pb_data/types.d.ts" />

// GH#98 follow-up (t_318f2396): enforce member_status on PB's native list/view
// reads. set_user_block only flips a stored flag — the custom /api/v1 and
// /api/entries handlers now reject blocked/pending accounts themselves, but the
// built-in /api/collections/* records API was still governed by rules that only
// checked ownership/family. This migration wraps every rule that grants a
// signed-in member read access with a status guard so a blocked or
// pending-approval account gets 403 on native reads too.
//
// NOTE: Goja may expose rule strings as wrapped values, so reads are coerced
// with String() — a strict `typeof rule === 'string'` check silently skips
// every collection (observed in 0.40.x during verification).
const STATUS_GUARD = '@request.auth.member_status != "blocked" && @request.auth.member_status != "pending_approval"';

// Collections a signed-in family member (or personal owner) can currently read
// through the native records API. users/families are included because a blocked
// member must not enumerate the family roster either.
const READABLE_COLLECTIONS = [
  'tasks', 'items', 'notes', 'labels', 'shops', 'calendar_events', 'sprints',
  'goals', 'projects', 'rewards', 'reminders', 'briefings',
  'users', 'families', 'invite_codes',
  'app_settings', 'integrations', 'ai_settings', 'api_tokens',
  'external_references', 'companion_devices', 'companion_notifications',
  'agent_keys', 'agent_audit_log',
];

function ruleString(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function applyGuardToRules(col) {
  ['listRule', 'viewRule'].forEach((ruleKey) => {
    const rule = ruleString(col[ruleKey]);
    // GH#34: migrations must be idempotent (re-running after a _migrations
    // wipe is a no-op) — never wrap a rule that already carries the guard.
    if (rule.trim() !== '' && rule.indexOf(STATUS_GUARD) === -1) {
      col[ruleKey] = `(${rule}) && ${STATUS_GUARD}`;
    }
  });
}

function removeGuardFromRules(col) {
  let changed = false;
  const suffix = ` && ${STATUS_GUARD}`;
  ['listRule', 'viewRule'].forEach((ruleKey) => {
    const rule = ruleString(col[ruleKey]);
    if (rule.endsWith(suffix)) {
      col[ruleKey] = rule.slice(0, -suffix.length);
      changed = true;
    }
  });
  return changed;
}

function rulesSnapshot(col) {
  return `${ruleString(col.listRule)}|${ruleString(col.viewRule)}`;
}

migrate(
  (app) => {
    for (const name of READABLE_COLLECTIONS) {
      try {
        const col = app.findCollectionByNameOrId(name);
        if (!col) continue;
        const before = rulesSnapshot(col);
        applyGuardToRules(col);
        if (rulesSnapshot(col) !== before) app.save(col);
      } catch (_) {
        // Collection does not exist at this migration point — skip.
      }
    }
  },
  (app) => {
    for (const name of READABLE_COLLECTIONS) {
      try {
        const col = app.findCollectionByNameOrId(name);
        if (!col) continue;
        if (removeGuardFromRules(col)) app.save(col);
      } catch (_) {}
    }
  }
);