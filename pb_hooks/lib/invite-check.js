// pb_hooks/lib/invite-check.js
// Public invite-code check behind GET and POST /api/validate-invite.
//
// The app sends the code in a POST body: PocketBase stores the URL of every
// request in its log (auxiliary.db), and the invite code is the one secret
// that lets someone into a household, so it must not be in a query string.
// GET ?code= stays for clients that cached the old bundle.
//
// The answer says only whether the code is usable (#235): no family id,
// family name or inviter. The registration screen never showed them, and
// anyone a link is forwarded to would learn the household and the inviter's
// name or e-mail before registering.

function checkInvite(app, rawCode) {
  var code = String(rawCode === null || rawCode === undefined ? '' : rawCode).trim().toUpperCase();
  if (!code) return { status: 400, body: { status: 'error', message: 'code required' } };

  var invites = app.findRecordsByFilter(
    'invite_codes',
    'code = {:code} && used = false && expires_at > {:now}',
    '-created', 1, 0,
    { code: code, now: new Date().toISOString() }
  );
  if (invites.length === 0) {
    return { status: 200, body: { valid: false, status: 'invalid_or_expired' } };
  }
  return {
    status: 200,
    body: { id: invites[0].id, code: code, valid: true, status: 'valid', message: 'Invite code is valid' }
  };
}

module.exports = { checkInvite: checkInvite };
