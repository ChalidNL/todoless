// Shared entry listing for GET /api/entries and POST /api/v1 {action:'list'}.
//
// GH#28: one users/labels lookup per id per request (memoised) instead of one
// per record, and the family scope is applied in the database query.
// GH#102: no silent 10 000-record cap (the DB is read in batches) and optional
// pagination. Without `page`/`perPage` the response stays the legacy bare array
// so existing integrations keep working; with either parameter it becomes
// { page, perPage, totalItems, totalPages, items }.
//
// The privacy rules are the same as the task/item collection rules: own
// records always; family records unless private; tasks with labels only when
// every label is visible to the caller.

var BATCH = 500;
var MAX_PER_PAGE = 500;
var DEFAULT_PER_PAGE = 100;

function createLookup() {
  var cache = {};
  return function (collection, id) {
    var key = collection + ':' + id;
    if (Object.prototype.hasOwnProperty.call(cache, key)) return cache[key];
    var record = null;
    try { record = $app.findRecordById(collection, id); } catch (e) { record = null; }
    cache[key] = record;
    return record;
  };
}

function asIdList(value) {
  if (Array.isArray(value)) return value;
  return value ? [String(value)] : [];
}

function isPrivate(r) {
  var v = r.get('is_private');
  return v === true || v === 1 || v === 'true';
}

function createAccess(auth, lookup) {
  var authFamily = String(auth.get('family_id') || '');

  function userFamily(userId) {
    var u = lookup('users', userId);
    return u ? String(u.get('family_id') || '') : null;
  }

  function canRead(r) {
    var uid = String(r.get('user') || r.get('created_by') || '');
    if (uid && uid === auth.id) return true;
    if (!authFamily || !uid) return false;
    return userFamily(uid) === authFamily;
  }

  function labelVisibility(label) {
    return String(label.get('visibility') || (label.get('is_private') ? 'private' : 'family'));
  }

  // Same rule as authLib.canAccessItemForUser, with the memoised lookups.
  function canReadItem(r) {
    if (!r) return false;
    if (String(r.get('user') || '') === auth.id) return true;
    if (isPrivate(r)) return false;
    return canRead(r);
  }

  function canAccessTask(r) {
    if (!r) return false;
    if (String(r.get('user') || '') === auth.id) return true;
    if (isPrivate(r)) return false;
    if (!authFamily || !canRead(r)) return false;
    var ids = asIdList(r.get('label') || r.get('labels') || []);
    if (ids.length > 1) {
      for (var mi = 0; mi < ids.length; mi++) {
        var mixed = lookup('labels', String(ids[mi] || ''));
        if (!mixed || labelVisibility(mixed) !== 'family') return false;
      }
    }
    for (var li = 0; li < ids.length; li++) {
      var labelId = String(ids[li] || '');
      if (!labelId) continue;
      var label = lookup('labels', labelId);
      if (!label) return false;
      var vis = labelVisibility(label);
      var owner = String(label.get('owner') || label.get('user') || '');
      var labelFamily = String(label.get('family') || '');
      if (!labelFamily && owner) {
        var ownerFamily = userFamily(owner);
        if (ownerFamily === null) return false;
        labelFamily = ownerFamily;
      }
      if (vis === 'private') { if (owner !== auth.id) return false; }
      else if (vis === 'shared') {
        var sharedWith = asIdList(label.get('shared_with') || []);
        if (owner !== auth.id && sharedWith.indexOf(auth.id) === -1) return false;
      } else if (labelFamily !== authFamily) return false;
    }
    return true;
  }

  return { canRead: canRead, canReadItem: canReadItem, canAccessTask: canAccessTask };
}

function readAll(collection, filter, params) {
  var out = [];
  for (var offset = 0; ; offset += BATCH) {
    var batch = $app.findRecordsByFilter(collection, filter, '-created', BATCH, offset, params);
    for (var i = 0; i < batch.length; i++) out.push(batch[i]);
    if (batch.length < BATCH) break;
  }
  return out;
}

function toEntry(r, type) {
  if (type === 'task') {
    return { id: r.id, type: 'task', title: r.get('title') || '', description: r.get('blocked_comment') || '', status: r.get('status') || 'todo', priority: r.get('priority') || 'medium', assignee_id: r.get('assigned_to') || '', labels: r.get('label') || r.get('labels') || [], shop_id: '', quantity: null, created_by: r.get('user') || '', completed_by: '', created_at: r.get('created'), updated_at: r.get('updated') };
  }
  return { id: r.id, type: 'grocery', title: r.get('title') || '', description: '', status: r.get('completed') ? 'done' : 'todo', priority: r.get('priority') || 'medium', assignee_id: r.get('assigned_to') || '', labels: require(__hooks + '/lib/json-field.js').readIdArray(r, 'labels'), shop_id: r.get('shop_id') || '', quantity: r.get('quantity') || 1, created_by: r.get('user') || '', completed_by: '', created_at: r.get('created'), updated_at: r.get('updated') };
}

function parsePositiveInt(raw) {
  var s = String(raw === undefined || raw === null ? '' : raw).trim();
  if (!s) return null;
  if (!/^\d+$/.test(s)) return NaN;
  return parseInt(s, 10);
}

/**
 * Returns { status, body } for the caller to send. `query` holds the string
 * parameters (type, status, assignee_id, label, shop_id, updated_since, page,
 * perPage).
 *
 * Pagination limits the payload, not the server work (#233): every request
 * reads all of the family's tasks and items, applies the privacy checks and
 * filters in JS, and only then slices out the page. The privacy rules
 * (private labels, private items, assignee visibility) are not expressible as
 * one DB filter, so a DB-level LIMIT/OFFSET would page over records the
 * caller may not see. Fine for household-sized data; don't rely on `page` to
 * reduce load.
 */
function listEntries(auth, query) {
  var q = query || {};
  var familyId = String(auth.get('family_id') || '');
  var filter = familyId ? 'user.family_id = {:familyId}' : 'user = {:userId}';
  var params = familyId ? { familyId: familyId } : { userId: auth.id };

  var sinceRaw = String(q.updated_since || '').trim();
  if (sinceRaw) {
    var since = new Date(sinceRaw);
    if (isNaN(since.getTime())) return { status: 400, body: { error: 'Invalid updated_since' } };
    filter += ' && updated >= {:since}';
    params.since = since.toISOString();
  }

  var page = parsePositiveInt(q.page);
  var perPage = parsePositiveInt(q.perPage);
  var paginate = page !== null || perPage !== null;
  if (paginate) {
    if (page === null) page = 1;
    if (perPage === null) perPage = DEFAULT_PER_PAGE;
    if (isNaN(page) || page < 1 || isNaN(perPage) || perPage < 1 || perPage > MAX_PER_PAGE) {
      return { status: 400, body: { error: 'page must be >= 1 and perPage between 1 and ' + MAX_PER_PAGE } };
    }
  }

  var type = String(q.type || '').trim();
  var status = String(q.status || '').trim();
  var assignee = String(q.assignee_id || '').trim();
  var label = String(q.label || '').trim();
  var shop = String(q.shop_id || '').trim();

  var access = createAccess(auth, createLookup());
  var all = [];
  if (!type || type === 'task') {
    var tasks = readAll('tasks', filter, params);
    for (var ti = 0; ti < tasks.length; ti++) if (access.canAccessTask(tasks[ti])) all.push(toEntry(tasks[ti], 'task'));
  }
  if (!type || type === 'grocery') {
    var items = readAll('items', filter, params);
    for (var ii = 0; ii < items.length; ii++) if (access.canReadItem(items[ii])) all.push(toEntry(items[ii], 'grocery'));
  }

  var res = [];
  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    if (type && e.type !== type) continue;
    if (status && e.status !== status) continue;
    if (assignee && e.assignee_id !== assignee) continue;
    if (label && (!Array.isArray(e.labels) || e.labels.indexOf(label) === -1)) continue;
    if (shop && e.shop_id !== shop) continue;
    res.push(e);
  }

  if (!paginate) return { status: 200, body: res };
  var start = (page - 1) * perPage;
  return {
    status: 200,
    body: {
      page: page,
      perPage: perPage,
      totalItems: res.length,
      totalPages: Math.ceil(res.length / perPage),
      items: res.slice(start, start + perPage),
    },
  };
}

module.exports = { listEntries: listEntries, createLookup: createLookup, createAccess: createAccess };
