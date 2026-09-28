// pb_hooks/01_api_token_auth.pb.js
// Compatibility shim: shared token helpers live in pb_hooks/lib/auth.js.

function _authLib() {
  return require(__hooks + '/lib/auth.js');
}

function hashToken(token) { return _authLib().hashToken(token); }
function generateToken(length) { return _authLib().generateToken(length); }
function bearerAuthMiddleware(c) { return _authLib().bearerAuthMiddleware(c); }
function checkTokenPermission(c, required) { return _authLib().checkTokenPermission(c, required); }

globalThis.hashToken = hashToken;
globalThis.generateToken = generateToken;
globalThis.bearerAuthMiddleware = bearerAuthMiddleware;
globalThis.checkTokenPermission = checkTokenPermission;
