/// <reference path="../pb_data/types.d.ts" />

// Ownership guard for DIRECT PocketBase collection API writes
// (/api/collections/{name}/records). Custom routes persist through $app.save()
// and never trigger *Request hooks, so server-side flows are unaffected.
//
// Why: several collections were created with createRule `@request.auth.id != ""`
// and updateRule `user = @request.auth.id`, which let any signed-in member
//   - create api_tokens / agent_keys with a self-chosen secret hash bound to
//     ANY user (incl. other families) -> full API access as the victim;
//   - create invite_codes bound to another user's family -> join that family;
//   - create owner-scoped records (items, shops, ...) in someone else's name,
//     or re-point `user` on their own records to another user/family.
//
// Rules:
//   1. api_tokens, agent_keys, invite_codes, families: native create is
//      forbidden for non-superusers — the dedicated routes (/api/api-tokens,
//      /api/agent/keys, /api/invites/create, /api/register) generate secrets
//      server-side and are the only supported path.
//   2. agent_keys, invite_codes: native update is forbidden for non-superusers
//      (revocation/consumption go through their routes).
//   3. Owner-scoped collections: on create `user` must be the caller (it is
//      filled in when omitted); on update the owner field may not change.
//
// NOTE: JSVM handlers run in isolated contexts — keep all constants inside
// the handler bodies (top-level variables are not visible to them).

onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next();
  throw new ForbiddenError('Use the dedicated API endpoint to create this record.');
}, 'api_tokens', 'agent_keys', 'invite_codes', 'families');

onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next();
  throw new ForbiddenError('Use the dedicated API endpoint to change this record.');
}, 'agent_keys', 'invite_codes');

onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next();
  const authId = e.auth ? String(e.auth.id || '') : '';
  if (!authId) throw new ForbiddenError('Authentication required.');
  const owner = String(e.record.get('user') || '');
  if (!owner) {
    e.record.set('user', authId);
  } else if (owner !== authId) {
    throw new ForbiddenError('Records can only be created for yourself.');
  }
  return e.next();
}, 'items', 'notes', 'shops', 'sprints', 'reminders', 'app_settings', 'rewards', 'goals',
  'integrations', 'projects', 'ai_settings', 'external_references', 'briefings',
  'companion_devices', 'companion_notifications');

onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next();
  const original = e.record.original();
  const ownerFields = ['user', 'owner', 'created_by'];
  for (let i = 0; i < ownerFields.length; i++) {
    const field = ownerFields[i];
    if (!e.record.collection().fields.getByName(field)) continue;
    if (String(original.get(field) || '') !== String(e.record.get(field) || '')) {
      throw new ForbiddenError('The owner of a record cannot be changed.');
    }
  }
  return e.next();
}, 'tasks', 'items', 'notes', 'labels', 'shops', 'sprints', 'reminders', 'app_settings',
  'rewards', 'goals', 'integrations', 'projects', 'ai_settings', 'external_references',
  'briefings', 'companion_devices', 'companion_notifications', 'calendar_events', 'families');
