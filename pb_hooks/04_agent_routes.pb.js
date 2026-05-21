// pb_hooks/routes/agent.js
// Agent API Token & Permission Model
// API-004
//
// POST /api/todoless/agent/token    - Create scoped API token for an agent
// GET  /api/todoless/agent/permissions - Returns available permission scopes

// ─── Available permission scopes ──────────────────────────────────────────
var AVAILABLE_PERMISSIONS = [
  'tasks:read',
  'tasks:write',
  'tasks:delete',
  'groceries:read',
  'groceries:write',
  'groceries:delete',
  'calendar:read',
  'calendar:write',
];

// ─── POST /api/todoless/agent/token ───────────────────────────────────────
// Creates a scoped API token for an agent.
// Auth: PB session auth (user must be authenticated).
// Body: { name, permissions, expires_at, agent_id }
//   name        - required, human-readable token name
//   permissions - required, array of permission strings
//   expires_at  - optional, ISO date string
//   agent_id    - optional, associate token with a specific agent user
//
// When agent_id is provided, the token is linked to that agent user.
// Default role for new agent tokens: 'assistant'.
routerAdd('POST', '/api/todoless/agent/token', function(c) {
  try {
    var info = c.requestInfo();
    var auth = info && info.auth ? info.auth : null;
    if (!auth) return c.json(401, { error: 'Unauthorized' });

    var d = info.data || info.body || {};
    var name = String(d.name || '').trim();
    var permissions = d.permissions || [];
    var expiresAt = d.expires_at || '';
    var agentId = String(d.agent_id || '').trim();

    if (!name) return c.json(400, { error: 'name is required' });
    if (!Array.isArray(permissions) || permissions.length === 0) {
      return c.json(400, { error: 'permissions array is required (min 1 permission)' });
    }

    // Validate permissions
    for (var pi = 0; pi < permissions.length; pi++) {
      var perm = String(permissions[pi] || '');
      var valid = false;
      for (var vi = 0; vi < AVAILABLE_PERMISSIONS.length; vi++) {
        if (perm === AVAILABLE_PERMISSIONS[vi]) { valid = true; break; }
      }
      // Allow wildcard: *
      if (perm === '*') { valid = true; }
      // Allow category wildcard: tasks:*, groceries:*, calendar:*
      var pParts = perm.split(':');
      if (pParts.length === 2 && pParts[1] === '*') {
        if (AVAILABLE_PERMISSIONS.indexOf(pParts[0] + ':read') !== -1) { valid = true; }
      }
      if (!valid) return c.json(400, { error: 'Invalid permission: ' + perm });
    }

    // Determine the user for this token
    var tokenUserId = auth.id;
    var tokenRole = String(auth.get('role') || 'user');

    // If agent_id provided, verify it exists and belongs to same family
    if (agentId) {
      var agentUser = null;
      try {
        agentUser = $app.dao().findRecordById('users', agentId);
      } catch (_e) {}
      if (!agentUser) return c.json(404, { error: 'Agent user not found' });

      // Verify family membership (if auth user has family)
      var authFamilyId = String(auth.get('family_id') || '');
      var agentFamilyId = String(agentUser.get('family_id') || '');
      if (authFamilyId && agentFamilyId && authFamilyId !== agentFamilyId) {
        return c.json(403, { error: 'Agent must be in same family' });
      }

      tokenUserId = agentId;
      // If agent doesn't have a role set, default to 'assistant'
      var agentRole = String(agentUser.get('role') || '');
      if (!agentRole || agentRole === 'user') {
        tokenRole = 'assistant';
      } else {
        tokenRole = agentRole;
      }
    }

    // Generate token
    var rawToken = generateAgentToken(48);
    var hashed = hashAgentToken(rawToken);

    var coll = $app.dao().findCollectionByNameOrId('api_tokens');
    var rec = new Record(coll);
    rec.set('name', name);
    rec.set('token_hash', hashed);
    rec.set('permissions', permissions);
    rec.set('enabled', true);
    rec.set('user', tokenUserId);

    if (expiresAt) rec.set('expires_at', expiresAt);

    $app.dao().saveRecord(rec);

    return c.json(201, {
      id: rec.id,
      name: name,
      token: rawToken,  // ONE-TIME return — never stored in plaintext
      permissions: permissions,
      enabled: true,
      expires_at: expiresAt || null,
      user: tokenUserId,
      role: tokenRole,
      created: new Date().toISOString(),
      message: 'Save this token — it will not be shown again.',
    });
  } catch (e) {
    return c.json(500, { error: String(e) });
  }
}, $apis.requireRecordAuth());

// ─── GET /api/todoless/agent/permissions ───────────────────────────────────
// Returns the list of available permission scopes for agents.
// No auth required (public information).
routerAdd('GET', '/api/todoless/agent/permissions', function(c) {
  try {
    var categories = {
      tasks: {
        label: 'Tasks',
        description: 'Task management operations',
        permissions: [
          { key: 'tasks:read', label: 'Read tasks', description: 'View tasks and their details' },
          { key: 'tasks:write', label: 'Create/Update tasks', description: 'Create new tasks and modify existing ones' },
          { key: 'tasks:delete', label: 'Delete tasks', description: 'Remove tasks permanently' },
        ],
      },
      groceries: {
        label: 'Groceries',
        description: 'Grocery item management',
        permissions: [
          { key: 'groceries:read', label: 'Read groceries', description: 'View grocery items and lists' },
          { key: 'groceries:write', label: 'Create/Update groceries', description: 'Add and modify grocery items' },
          { key: 'groceries:delete', label: 'Delete groceries', description: 'Remove grocery items permanently' },
        ],
      },
      calendar: {
        label: 'Calendar',
        description: 'Calendar event management',
        permissions: [
          { key: 'calendar:read', label: 'Read calendar', description: 'View calendar events' },
          { key: 'calendar:write', label: 'Create/Update calendar', description: 'Create and modify calendar events' },
        ],
      },
    };

    var wildcards = [
      { key: '*', label: 'Full access', description: 'All permissions across all resources' },
    ];

    return c.json(200, {
      permissions: AVAILABLE_PERMISSIONS,
      categories: categories,
      wildcards: wildcards,
      description: 'Permission scopes control what operations an agent token can perform. Grant only the minimum permissions needed.',
    });
  } catch (e) {
    return c.json(500, { error: String(e) });
  }
});

// ─── Token generation helpers ───────────────────────────────────────────────

function generateAgentToken(length) {
  if (typeof length === 'undefined') length = 48;
  var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var result = '';
  for (var i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return 'tagent_' + result;
}

function hashAgentToken(token) {
  try {
    return $security.SHA256(token);
  } catch (e) {
    // Fallback for dev
    var hash = 0;
    if (token.length === 0) return 'dev_hash_empty';
    for (var i = 0; i < token.length; i++) {
      var char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'dev_' + Math.abs(hash).toString(16).padStart(8, '0');
  }
}