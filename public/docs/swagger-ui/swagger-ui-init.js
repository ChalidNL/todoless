// Swagger UI bootstrap for the vendored API docs page (GH#64).
//
// This file is repo-owned and served same-origin from /docs/swagger-ui/, so the
// nginx CSP can stay at `script-src 'self'` — no external CDN and no inline
// script. It must be loaded AFTER swagger-ui-bundle.js and
// swagger-ui-standalone-preset.js.
//
// The OpenAPI spec URL is derived from the current route so the same file works
// for every alias:
//   /api/docs        -> /api/openapi.json
//   /api/swagger     -> /api/openapi.json
//   /api/v1/docs     -> /api/v1/openapi.json  (legacy alias)
(function () {
  'use strict';

  var specUrl = location.pathname.replace(/\/+(docs|swagger)\/?$/, '') + '/openapi.json';

  window.ui = SwaggerUIBundle({
    url: specUrl,
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [
      SwaggerUIBundle.presets.apis,
      // Standalone preset is a separate dist file (swagger-ui-standalone-preset.js)
      // that defines the global — the equivalent property does not exist on the
      // SwaggerUIBundle export, so the preset must be referenced as a plain global.
      SwaggerUIStandalonePreset,
    ],
    layout: 'StandaloneLayout',
    // No external validator call — works in air-gapped LANs (zero outbound).
    validatorUrl: null,
    defaultModelsExpandDepth: 1,
    defaultModelExpandDepth: 1,
    docExpansion: 'list',
    filter: true,
    showExtensions: true,
    tryItOutEnabled: true,
    requestSnippets: {
      generators: {
        curl_bash: { title: 'cURL (bash)', syntax: 'bash' },
        curl_powershell: { title: 'cURL (PowerShell)', syntax: 'powershell' },
        curl_cmd: { title: 'cURL (CMD)', syntax: 'bash' },
      },
      defaultExpanded: true,
      languages: ['curl_bash', 'curl_powershell'],
    },
  });
})();