// Standalone unit test for the GH#20 permission validation fix.
// Extracts the exact validation logic from pb_hooks/09_api_tokens.pb.js
// (CREATE handler) and exercises it with node, since spinning up a full
// PocketBase+Goja runtime is not available in this environment.

function validatePerms(rawPerms, authRole) {
  var validResources = ['tasks', 'groceries', 'calendar'];
  var validPerms = ['tasks:read','tasks:write','tasks:delete','groceries:read','groceries:write','groceries:delete','calendar:read','calendar:write','tasks:*','groceries:*','calendar:*','*'];
  var results = [];
  for (var pi = 0; pi < rawPerms.length; pi++) {
    var perm = String(rawPerms[pi] || '');
    var valid = false;
    for (var vpi = 0; vpi < validPerms.length; vpi++) {
      if (perm === validPerms[vpi]) { valid = true; break; }
    }
    if (!valid) {
      var pParts = perm.split(':');
      if (pParts.length === 2 && pParts[1] === '*' && validResources.indexOf(pParts[0]) !== -1) { valid = true; }
    }
    if (!valid) { results.push({ perm: perm, outcome: '400 Invalid permission' }); continue; }
    if ((perm === '*' || perm.indexOf(':*') > 0) && authRole !== 'admin' && authRole !== 'owner') {
      results.push({ perm: perm, outcome: '403 Admin only permission' });
      continue;
    }
    results.push({ perm: perm, outcome: 'accepted' });
  }
  return results;
}

const cases = [
  // [permission, authRole, expectedOutcome]
  ['tasks:read', 'user', 'accepted'],
  ['tasks:write', 'user', 'accepted'],
  ['tasks:*', 'admin', 'accepted'],
  ['tasks:*', 'user', '403 Admin only permission'],
  ['groceries:*', 'owner', 'accepted'],
  ['calendar:*', 'admin', 'accepted'],
  ['*', 'admin', 'accepted'],
  ['*', 'user', '403 Admin only permission'],
  // GH#20 regression cases — these MUST now be rejected as invalid
  ['admin:*', 'admin', '400 Invalid permission'],
  ['users:*', 'admin', '400 Invalid permission'],
  ['api_tokens:*', 'admin', '400 Invalid permission'],
  ['agents:*', 'admin', '400 Invalid permission'],
  ['foo:*', 'user', '400 Invalid permission'],
  ['xxx:*', 'admin', '400 Invalid permission'],
  ['families:*', 'admin', '400 Invalid permission'],
];

let failures = 0;
for (const [perm, role, expected] of cases) {
  const [result] = validatePerms([perm], role);
  const pass = result.outcome === expected;
  if (!pass) failures++;
  console.log(`${pass ? 'PASS' : 'FAIL'} perm=${JSON.stringify(perm)} role=${role} -> ${result.outcome} (expected ${expected})`);
}

console.log(`\n${cases.length - failures}/${cases.length} passed`);
if (failures > 0) {
  console.error(`${failures} FAILURES`);
  process.exit(1);
}
process.exit(0);
