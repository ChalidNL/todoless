// pb_hooks/lib/auth.js
// Shared Bearer token / API-key helpers for PocketBase hook handlers.
// Load from route callbacks with: require(__hooks + '/lib/auth.js')

function hashToken(token) {
  return $security.sha256(token);
}

function generateToken(length) {
  if (typeof length === 'undefined') length = 48;
  return 'tl_' + $security.randomString(length);
}

function generateAgentKey() {
  return 'tlsk_' + $security.randomString(40);
}

function getKeyPrefix(key) {
  return String(key || '').substring(0, 12);
}

function parseScopes(record) {
  var scopeText = '';
  try { scopeText = String(record.getString('permissions') || ''); } catch (_e) {}
  if (!scopeText || scopeText === '[]') {
    try { scopeText = String(record.getString('scopes') || ''); } catch (_e2) {}
  }
  var scopes = [];
  if (scopeText) {
    try { scopes = JSON.parse(scopeText); } catch (_e3) { scopes = scopeText.split(','); }
  }
  if (!Array.isArray(scopes)) scopes = [];
  var out = [];
  for (var i = 0; i < scopes.length; i++) {
    var s = String(scopes[i] || '').trim();
    if (s) out.push(s);
  }
  return out;
}

function isEnabled(record) {
  var raw = record.get('enabled');
  if (raw === undefined || raw === null || raw === '') raw = record.get('active');
  return raw !== false && raw !== 0 && raw !== 'false';
}

function expiryMs(record) {
  var rawExp = record.get('expires_at');
  if (!rawExp) return 0;
  if (typeof rawExp === 'string') return new Date(String(rawExp).replace(' ', 'T')).getTime();
  if (rawExp && typeof rawExp.getTime === 'function') return rawExp.getTime();
  return new Date(String(rawExp).replace(' ', 'T')).getTime();
}

function getBearerToken(c) {
  var headers = c.requestInfo().headers || {};
  var authHeader = headers.authorization || headers.Authorization || '';
  if (!authHeader) return { missing: true, token: '' };
  var parts = String(authHeader).split(' ');
  if (parts.length !== 2 || String(parts[0]).toLowerCase() !== 'bearer' || !parts[1]) {
    return { error: 'Invalid Authorization header format. Use: Bearer <token>' };
  }
  var token = String(parts[1] || '').trim();
  if (!token) return { error: 'Empty token' };
  return { token: token };
}

function buildTokenInfo(record, user) {
  return {
    token_id: record.id,
    token_name: String(record.get('name') || ''),
    user_id: user.id,
    user_role: String(user.get('role') || 'user'),
    user_name: String(user.get('name') || user.get('email') || ''),
    family_id: String(user.get('family_id') || ''),
    permissions: parseScopes(record),
  };
}

function findApiTokenByRaw(rawToken) {
  var hashed = hashToken(rawToken);
  var tokens = $app.findRecordsByFilter('api_tokens', 'token_hash = {:hash}', '', 1, 0, { hash: hashed });
  if (tokens.length > 0) return tokens[0];
  return null;
}

function bearerAuthMiddleware(c, options) {
  options = options || {};
  try {
    var parsed = getBearerToken(c);
    if (parsed.missing) return null;
    if (parsed.error) return options.lenientInvalidHeader ? null : c.json(401, { error: parsed.error });

    var tokRec = findApiTokenByRaw(parsed.token);
    if (!tokRec) return null;

    if (!isEnabled(tokRec)) return c.json(401, { error: 'API token is disabled' });
    var expMs = expiryMs(tokRec);
    if (expMs > 0 && expMs < Date.now()) return c.json(401, { error: 'API token has expired' });

    var userId = String(tokRec.get('user') || '');
    var user = null;
    try { user = $app.findRecordById('users', userId); } catch (e) { return c.json(401, { error: 'Token owner not found' }); }
    if (!user) return c.json(401, { error: 'Token owner not found' });

    var rawActive = user.get('active');
    if (rawActive === false || rawActive === 0 || rawActive === 'false') return c.json(403, { error: 'Token owner account is blocked' });
    var rawMemberStatus = user.get('member_status');
    if (rawMemberStatus === 'blocked') return c.json(403, { error: 'Token owner account is blocked' });
    if (rawMemberStatus === 'pending_approval') return c.json(403, { error: 'Token owner is pending approval' });

    c.set('apiTokenInfo', buildTokenInfo(tokRec, user));
    c.set('authRecord', user);
    return null;
  } catch (e) {
    var errorsLib = require(__hooks + '/lib/errors.js');
    return errorsLib.respondError(c, e, 500);
  }
}

function checkTokenPermission(c, required) {
  try {
    var tokInfo = c.get('apiTokenInfo');
    if (!tokInfo) return true;
    return hasScopeList(tokInfo.permissions || [], required);
  } catch (e) {
    return false;
  }
}

function hasScopeList(scopes, requiredScope) {
  if (!Array.isArray(scopes)) scopes = [];
  var familyScope = String(requiredScope || '').split(':')[0] + ':*';
  for (var i = 0; i < scopes.length; i++) {
    var s = String(scopes[i] || '').trim();
    if (s === '*' || s === requiredScope || s === familyScope) return true;
    if (requiredScope === 'entries:read' && s === 'entries:write') return true;
    if (requiredScope === 'users:read' && s === 'users:admin') return true;
    if (String(requiredScope || '').indexOf('entries:') === 0 && (s === 'tasks:*' || s === 'groceries:*')) return true;
  }
  return false;
}

function hasScope(recordOrInfo, requiredScope) {
  var scopes = Array.isArray(recordOrInfo) ? recordOrInfo : parseScopes(recordOrInfo);
  return hasScopeList(scopes, requiredScope);
}

function hasAgentScope(agentKey, requiredScope) {
  var scopes = parseScopes(agentKey);
  if (scopes.indexOf('*') !== -1 || scopes.indexOf(requiredScope) !== -1) return true;
  if (requiredScope === 'entries:read' && scopes.indexOf('entries:write') !== -1) return true;
  if (requiredScope === 'users:read' && scopes.indexOf('users:admin') !== -1) return true;
  return false;
}

function requireApiToken(c, messages) {
  messages = messages || {};
  var parsed = getBearerToken(c);
  if (parsed.missing) return { error: messages.missingError || 'Missing API key', status: 401 };
  if (parsed.error) return { error: messages.invalidHeaderError || 'Invalid Authorization header', status: 401 };

  var key = findApiTokenByRaw(parsed.token);
  if (!key) return { error: messages.invalidError || 'Invalid API key', status: 401 };
  if (!isEnabled(key)) return { error: messages.revokedError || 'Revoked', status: 401 };
  var expMs = expiryMs(key);
  if (expMs > 0 && expMs < Date.now()) return { error: messages.expiredError || 'Expired', status: 401 };

  var uid = String(key.get('user') || '');
  if (!uid) return { error: messages.noOwnerError || 'No owner', status: 401 };
  var user = null;
  try { user = $app.findRecordById('users', uid); } catch (e) {}
  if (!user) return { error: messages.userNotFoundError || 'User not found', status: 401 };
  var ms = String(user.get('member_status') || 'active');
  if (ms === 'blocked') return { error: 'Token owner account is blocked', status: 403 };
  if (ms === 'pending_approval') return { error: 'Token owner is pending approval', status: 403 };
  var fid = String(user.get('family_id') || '');
  if (!fid) return { error: messages.noFamilyError || 'No family', status: 401 };
  return { uid: uid, fid: fid, key: key, user: user };
}

function authFromAgentKey(c) {
  var parsed = getBearerToken(c);
  if (parsed.missing || parsed.error) return null;
  var token = parsed.token;
  var prefix = getKeyPrefix(token);
  var candidates = $app.findRecordsByFilter('agent_keys', 'key_prefix = {:prefix} && active = true', '', 10, 0, { prefix: prefix });
  for (var i = 0; i < candidates.length; i++) {
    var storedHash = candidates[i].get('key_hash');
    if ($security.equal(storedHash, hashToken(token))) {
      throttleLastUsedAt(candidates[i]);
      return candidates[i];
    }
  }
  return null;
}

function throttleLastUsedAt(record) {
  try {
    var lastUsedRaw = record.get('last_used_at');
    var lastUsedMs = 0;
    if (lastUsedRaw) {
      var lastUsedDate = new Date(String(lastUsedRaw).replace(' ', 'T'));
      if (!isNaN(lastUsedDate.getTime())) lastUsedMs = lastUsedDate.getTime();
    }
    if (!lastUsedMs || (Date.now() - lastUsedMs) >= 60000) {
      record.set('last_used_at', new Date().toISOString());
      $app.save(record);
    }
  } catch (_e) {}
}

function gv(o, k, f) {
  if (f === undefined) f = '';
  if (!o || !Object.prototype.hasOwnProperty.call(o, k)) return f;
  var value = o[k];
  return value === undefined || value === null ? f : value;
}

function getAgentUserFamily(agentKey) {
  var userId = String(agentKey.get('user') || '');
  if (!userId) return null;
  try { return $app.findRecordById('users', userId); } catch (_e) { return null; }
}

function auditLog(agentKey, action, entityType, entityId, details) {
  try {
    var audit = new Record($app.findCollectionByNameOrId('agent_audit_log'));
    audit.set('agent_key_id', agentKey.id);
    audit.set('agent_name', agentKey.get('name') || '');
    audit.set('action', action);
    audit.set('entity_type', entityType || '');
    audit.set('entity_id', entityId || '');
    audit.set('details', details || {});
    audit.set('ip_address', '');
    audit.set('user', agentKey.get('user'));
    $app.save(audit);
  } catch (_e) {}
}

function normalizeLabelIds(value) {
  if (Array.isArray(value)) return value.map(function(id) { return String(id || ''); }).filter(Boolean);
  return value ? [String(value)] : [];
}

function setCanonicalTaskLabels(record, value) {
  var ids = normalizeLabelIds(value);
  record.set('labels', ids);
  record.set('label', ids);
}

function canAccessTaskForUser(record, user) {
  if (!record || !user) return false;
  var userId = user.id;
  var ownerId = String(record.get('user') || '');
  if (ownerId === userId) return true;
  if (record.get('is_private') === true || record.get('is_private') === 1 || record.get('is_private') === 'true') return false;
  var familyId = String(user.get('family_id') || '');
  if (!familyId || !ownerId) return false;
  try { if (String($app.findRecordById('users', ownerId).get('family_id') || '') !== familyId) return false; } catch (_e) { return false; }
  var labelIds = normalizeLabelIds(record.get('label') || record.get('labels') || []);
  if (labelIds.length > 1) {
    for (var mixedIndex = 0; mixedIndex < labelIds.length; mixedIndex++) {
      var mixedLabel = null;
      try { mixedLabel = $app.findRecordById('labels', labelIds[mixedIndex]); } catch (_e2) { return false; }
      var mixedVisibility = String(mixedLabel.get('visibility') || (mixedLabel.get('is_private') ? 'private' : 'family'));
      if (mixedVisibility !== 'family') return false;
    }
  }
  for (var i = 0; i < labelIds.length; i++) {
    var label = null;
    try { label = $app.findRecordById('labels', labelIds[i]); } catch (_e3) { return false; }
    var visibility = String(label.get('visibility') || (label.get('is_private') ? 'private' : 'family'));
    var labelOwner = String(label.get('owner') || label.get('user') || '');
    var labelFamily = String(label.get('family') || '');
    if (!labelFamily && labelOwner) { try { labelFamily = String($app.findRecordById('users', labelOwner).get('family_id') || ''); } catch (_e4) { return false; } }
    if (visibility === 'private' && labelOwner !== userId) return false;
    if (visibility === 'shared') {
      var sharedWith = normalizeLabelIds(label.get('shared_with') || []);
      if (labelOwner !== userId && sharedWith.indexOf(userId) === -1) return false;
    }
    if (visibility === 'family' && labelFamily !== familyId) return false;
  }
  return true;
}

module.exports = {
  hashToken: hashToken,
  generateToken: generateToken,
  generateAgentKey: generateAgentKey,
  getKeyPrefix: getKeyPrefix,
  parseScopes: parseScopes,
  bearerAuthMiddleware: bearerAuthMiddleware,
  checkTokenPermission: checkTokenPermission,
  requireApiToken: requireApiToken,
  authFromAgentKey: authFromAgentKey,
  hasScope: hasScope,
  hasAgentScope: hasAgentScope,
  hasScopeList: hasScopeList,
  gv: gv,
  getAgentUserFamily: getAgentUserFamily,
  auditLog: auditLog,
  normalizeLabelIds: normalizeLabelIds,
  setCanonicalTaskLabels: setCanonicalTaskLabels,
  canAccessTaskForUser: canAccessTaskForUser,
};