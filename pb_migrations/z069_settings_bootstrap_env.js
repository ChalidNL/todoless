/// <reference path="../pb_data/types.d.ts" />

// GH#51 — Bootstrap PocketBase settings from the environment.
//
// On a fresh install every PocketBase setting is a default: meta.appName is
// "Acme", meta.appURL is "http://localhost:8090", smtp.enabled is false (host
// "smtp.example.com"), trustedProxy is empty. .env.example documented SMTP_*
// variables (and now also documents APP_*/TRUSTED_PROXY_*), but nothing ever
// applied them, so any e-mail PocketBase would send (verification, password
// reset) would come from "Acme" via a non-existent server.
//
// This migration applies the subset below WHEN SET (empty/unset values are
// skipped and the rest of the settings is left alone):
//
//   APP_NAME                      -> meta.appName
//   APP_URL                       -> meta.appURL          (http(s) only; invalid values warn + skip)
//   SMTP_HOST                     -> smtp.enabled = true, smtp.host
//   SMTP_PORT                     -> smtp.port            (defaults to 587; 1..65535 validated)
//   SMTP_USERNAME                 -> smtp.username        (when set)
//   SMTP_PASSWORD                 -> smtp.password        (when set; never logged)
//   SMTP_FROM                     -> meta.senderAddress   (when set)
//   SMTP_AUTH_METHOD              -> smtp.authMethod      (when set; "Plain" or "Login")
//   TRUSTED_PROXY_HEADERS         -> trustedProxy.headers          (comma-separated list)
//   TRUSTED_PROXY_USE_LEFTMOST_IP -> trustedProxy.useLeftmostIP    ("true"/"false"; other values warn + skip)
//
// The migration runs exactly once per install (fresh installs and upgrades
// alike). After that the admin Dashboard/API is the source of truth; changing
// the env vars later does NOT re-apply. Passwords are never logged.
migrate(
  function (app) {
    var env = (typeof process !== 'undefined' && process.env) ? process.env : {};
    var settings = app.settings();
    var changed = false;
    var applied = [];

    function isSet(v) {
      return typeof v === 'string' && v.trim() !== '';
    }

    function applyString(getter, setter, label) {
      var v = getter();
      if (!isSet(v)) return;
      setter(v.trim());
      changed = true;
      applied.push(label);
    }

    applyString(
      function () { return env.APP_NAME; },
      function (v) { settings.meta.appName = v; },
      'APP_NAME'
    );

    // APP_URL must be an absolute http(s) URL — PocketBase validates this at
    // save and a bad value would fail the whole migration (crash-loop under
    // serve --automigrate). Warn and skip instead so a typo never blocks boot.
    if (isSet(env.APP_URL)) {
      var appUrl = env.APP_URL.trim();
      if (appUrl.indexOf('http://') === 0 || appUrl.indexOf('https://') === 0) {
        settings.meta.appURL = appUrl;
        changed = true;
        applied.push('APP_URL');
      } else {
        console.log('[settings-bootstrap] WARNING: APP_URL "' + appUrl + '" is not an http(s) URL — skipped; meta.appURL left unchanged');
      }
    }

    // SMTP is enabled only when a host is provided; the rest of the SMTP
    // fields are applied when set and the others are left alone.
    if (isSet(env.SMTP_HOST)) {
      settings.smtp.enabled = true;
      settings.smtp.host = env.SMTP_HOST.trim();
      changed = true;
      applied.push('SMTP_HOST');

      var port = parseInt(env.SMTP_PORT, 10);
      var useDefaultPort = false;
      if (isSet(env.SMTP_PORT)) {
        if (isFinite(port) && port >= 1 && port <= 65535) {
          settings.smtp.port = port;
          applied.push('SMTP_PORT');
        } else {
          useDefaultPort = true;
          console.log('[settings-bootstrap] WARNING: SMTP_PORT "' + env.SMTP_PORT + '" is not a valid port (1..65535) — using default 587');
        }
      } else {
        useDefaultPort = true;
      }
      if (useDefaultPort) {
        settings.smtp.port = 587;
        applied.push('SMTP_PORT(default 587)');
      }

      applyString(
        function () { return env.SMTP_USERNAME; },
        function (v) { settings.smtp.username = v; },
        'SMTP_USERNAME'
      );

      applyString(
        function () { return env.SMTP_PASSWORD; },
        function (v) { settings.smtp.password = v; },
        'SMTP_PASSWORD'
      );

      applyString(
        function () { return env.SMTP_FROM; },
        function (v) { settings.meta.senderAddress = v; },
        'SMTP_FROM'
      );

      // PB 0.35 validates smtp.authMethod against the constants "PLAIN" and
      // "LOGIN" (uppercase). Accept the documented env values case-insensitively
      // and normalize; anything else warns + skips so a typo never aborts the
      // migration.
      if (isSet(env.SMTP_AUTH_METHOD)) {
        var authMethod = env.SMTP_AUTH_METHOD.trim().toUpperCase();
        if (authMethod === 'PLAIN' || authMethod === 'LOGIN') {
          settings.smtp.authMethod = authMethod;
          changed = true;
          applied.push('SMTP_AUTH_METHOD=' + authMethod);
        } else {
          console.log('[settings-bootstrap] WARNING: SMTP_AUTH_METHOD "' + env.SMTP_AUTH_METHOD + '" is invalid — expected "Plain" or "Login" — skipped; smtp.authMethod left unchanged');
        }
      }
    }

    function isHeaderName(v) {
      return /^[A-Za-z0-9_-]+$/.test(v);
    }

    if (isSet(env.TRUSTED_PROXY_HEADERS)) {
      var trustedHeaders = env.TRUSTED_PROXY_HEADERS
        .split(',')
        .map(function (h) { return h.trim(); })
        .filter(function (h) { return h !== ''; });
      var validTrustedHeaders = [];
      trustedHeaders.forEach(function (h) {
        if (isHeaderName(h)) {
          validTrustedHeaders.push(h);
        } else {
          console.log('[settings-bootstrap] WARNING: TRUSTED_PROXY_HEADERS entry "' + h + '" is not a valid HTTP header name — skipped');
        }
      });
      if (validTrustedHeaders.length > 0) {
        settings.trustedProxy.headers = validTrustedHeaders;
        changed = true;
        applied.push('TRUSTED_PROXY_HEADERS');
      } else {
        console.log('[settings-bootstrap] WARNING: TRUSTED_PROXY_HEADERS had no valid header names — skipped');
      }
    }

    if (isSet(env.TRUSTED_PROXY_USE_LEFTMOST_IP)) {
      var raw = env.TRUSTED_PROXY_USE_LEFTMOST_IP.trim().toLowerCase();
      if (raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on') {
        settings.trustedProxy.useLeftmostIP = true;
        changed = true;
        applied.push('TRUSTED_PROXY_USE_LEFTMOST_IP=true');
      } else if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off') {
        settings.trustedProxy.useLeftmostIP = false;
        changed = true;
        applied.push('TRUSTED_PROXY_USE_LEFTMOST_IP=false');
      } else {
        console.log('[settings-bootstrap] WARNING: TRUSTED_PROXY_USE_LEFTMOST_IP "' + env.TRUSTED_PROXY_USE_LEFTMOST_IP + '" is not a boolean (true/false, 1/0, yes/no, on/off) — skipped');
      }
    }

    if (changed) {
      app.save(settings);
      console.log('[settings-bootstrap] applied: ' + applied.join(', '));
    } else {
      console.log('[settings-bootstrap] no APP_/SMTP_/TRUSTED_PROXY_* overrides in env — leaving PocketBase settings untouched');
    }
  },
  function (app) {
    // Intentionally no rollback: settings are operator-owned, not schema.
  }
);