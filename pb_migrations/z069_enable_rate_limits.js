/// <reference path="../pb_data/types.d.ts" />

// Migration z069: Enable PocketBase's built-in rate limiter (GH#10)
//
// GH#10 was filed because pb_hooks/00_rate_limiter.js shipped WITHOUT the .pb.js
// suffix, so PocketBase never loaded it and nothing require()'d it — the only
// request throttling in the app was nginx's limit_req zones. The dead file has
// since been removed (GH#31 cleanup, PR #196); this migration implements the
// issue's second suggested fix: enable PocketBase's native
// settings.rateLimits as an application-level backstop.
//
// Defense-in-depth layering (PB is deliberately MORE lenient than nginx so the
// proxy stays the primary gate and PB only catches direct-PocketBase access or
// misconfiguration):
//   - nginx api_auth zone:   5 r/m,  burst 10  (auth endpoints, GH#42)
//   - nginx api_general zone: 30 r/s, burst 120 (/api/ + docs, GH#42)
//   - PB "*:auth" (guests):   30 r/min           brute-force backstop
//   - PB "/api/" (all):       600 r/10s (=60/s)  whole-API-tree backstop
//   - PB guest rules for the public register/invite/token/webhook surface.
//
// trustedProxy is REQUIRED for the builtin limiter to work behind the nginx
// proxy: without it every request would appear to come from the proxy container
// (172.x) and one user's burst would throttle the whole deployment. We trust
// X-Forwarded-For but use the RIGHTMOST parseable IP (useLeftmostIP=false) —
// nginx always APPENDS the true socket peer via $proxy_add_x_forwarded_for, so
// the rightmost value is the real client and cannot be spoofed past nginx
// (matches the GH#41 stance of never trusting client-supplied leftmost headers).
//
// Guard rails: the rate-limit rules are only applied when the settings are
// still at their stock defaults (rateLimits disabled + default rules). Once a
// user has configured anything via Settings -> Application, we leave it alone.
// trustedProxy is set ONLY when unconfigured (empty headers); an
// operator-configured trustedProxy is preserved untouched (their choice
// decides per-client keying for the enabled limiter).

// Rules applied by this migration (aligned with the nginx zones above).
// audience: "" = guests + authenticated, "@guest" = unauthenticated only.
const RATE_LIMIT_RULES = [
  // Whole /api/ tree backstop (PB collections CRUD + all custom /api/* routes).
  { label: '/api/',            audience: '',      maxRequests: 600, duration: 10 },
  // PB auth tag covers auth-with-password, password-reset, verification, ... :
  // guests only so a family sharing one public IP is never blocked while logged in.
  { label: '*:auth',           audience: '@guest', maxRequests: 30,  duration: 60 },
  // Public registration / invite surface.
  { label: '/api/register',        audience: '@guest', maxRequests: 15, duration: 60 },
  { label: '/api/invites/create',  audience: '@guest', maxRequests: 15, duration: 60 },
  { label: '/api/validate-invite', audience: '@guest', maxRequests: 60, duration: 60 },
  // Member token issuance endpoints (guest attempts are 401s; cap the hammering).
  { label: '/api/members/',        audience: '@guest', maxRequests: 30, duration: 60 },
  // Secret-gated webhooks: allow provider batching, still bounded.
  { label: '/api/integrations/mail/webhook',      audience: '@guest', maxRequests: 60, duration: 60 },
];

// PocketBase stock defaults (core/settings_model.go) - used by the guard and
// by the rollback to restore the pre-migration state exactly.
const STOCK_RULES = [
  { label: '*:auth',     audience: '', maxRequests: 2,   duration: 3 },
  { label: '*:create',   audience: '', maxRequests: 20,  duration: 5 },
  { label: '/api/batch', audience: '', maxRequests: 3,   duration: 1 },
  { label: '/api/',      audience: '', maxRequests: 300, duration: 10 },
];

const TRUSTED_PROXY_HEADERS = ['X-Forwarded-For'];

function sortedArraysEqual(a, b, normalize) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }
  const as = a.map(normalize).sort();
  const bs = b.map(normalize).sort();
  for (let i = 0; i < as.length; i++) {
    if (as[i] !== bs[i]) {
      return false;
    }
  }
  return true;
}

function rulesEqual(a, b) {
  return sortedArraysEqual(a, b, (r) =>
    [String(r.label || ''), String(r.audience || ''), Number(r.maxRequests), Number(r.duration)].join('|'),
  );
}

function stringsEqual(a, b) {
  return sortedArraysEqual(a, b, (s) => String(s || ''));
}

migrate(
  (app) => {
    const settings = app.settings();

    const rl = settings.rateLimits;
    if (!rl) {
      return; // settings schema without rate limits - nothing to do
    }

    // Already enabled (or customized while disabled) -> never clobber user config.
    if (rl.enabled || !rulesEqual(rl.rules, STOCK_RULES)) {
      return;
    }

    rl.enabled = true;
    rl.rules = RATE_LIMIT_RULES;

    // Required for per-client keying behind the nginx proxy (see header comment).
    if (
      settings.trustedProxy &&
      (!settings.trustedProxy.headers || settings.trustedProxy.headers.length === 0)
    ) {
      settings.trustedProxy.headers = TRUSTED_PROXY_HEADERS;
      settings.trustedProxy.useLeftmostIP = false;
    }

    app.save(settings);
  },
  (app) => {
    const settings = app.settings();
    const rl = settings.rateLimits;
    if (!rl) {
      return;
    }

    // Only roll back if the state is still exactly what this migration applied.
    if (
      !rl.enabled ||
      !rulesEqual(rl.rules, RATE_LIMIT_RULES) ||
      !settings.trustedProxy ||
      !stringsEqual(settings.trustedProxy.headers, TRUSTED_PROXY_HEADERS) ||
      settings.trustedProxy.useLeftmostIP !== false
    ) {
      return;
    }

    rl.enabled = false;
    rl.rules = STOCK_RULES;
    settings.trustedProxy.headers = [];
    settings.trustedProxy.useLeftmostIP = false;

    app.save(settings);
  },
);