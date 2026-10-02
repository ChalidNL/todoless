/// <reference path="../pb_data/types.d.ts" />

// Ownership rules for direct collection API writes
// (/api/collections/{name}/records). Custom routes persist through $app.save()
// and never trigger *Request hooks.
//   1. api_tokens, agent_keys, invite_codes, families: no native create for
//      non-superusers; their routes generate the secrets server-side.
//   2. agent_keys, invite_codes: no native update (revoke/redeem via routes).
//   3. Owner-scoped collections: `user` is the caller on create (filled in
//      when omitted) and cannot change on update.
// Constants live inside the handlers: callbacks cannot see top-level values.

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

// Labels: `family` defaults to the caller's family (#231). labels.createRule
// allows `family = ""`, but every task rule requires
// `label.family:each = @request.auth.family_id`, so a label created without a
// family (API clients - the UI always sets it) made each task that used it
// un-editable for its own owner: 404 on every PATCH, 400 on create. The same
// for an update that blanks the field (see the update guard below). The
// logic is inlined in both handlers - handlers cannot see top-level helpers.
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next();
  if (e.auth && !String(e.record.get('family') || '')) {
    const callerFamily = String(e.auth.get('family_id') || '');
    if (callerFamily) e.record.set('family', callerFamily);
  }
  return e.next();
}, 'labels');

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
  // #231: a label update must not leave `family` empty either
  if (e.record.collection().name === 'labels' && e.auth && !String(e.record.get('family') || '')) {
    const callerFamily = String(e.auth.get('family_id') || '');
    if (callerFamily) e.record.set('family', callerFamily);
  }
  return e.next();
}, 'tasks', 'items', 'notes', 'labels', 'shops', 'sprints', 'reminders', 'app_settings',
  'rewards', 'goals', 'integrations', 'projects', 'ai_settings', 'external_references',
  'briefings', 'companion_devices', 'companion_notifications', 'calendar_events', 'families');
