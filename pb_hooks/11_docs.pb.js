/// <reference path="../../pb_data/types.d.ts" />

// Swagger UI HTML page for interactive API exploration
// Served at: GET /api/docs
//
// GH#64: swagger-ui-dist is vendored into public/docs/swagger-ui (committed to
// the repo, see scripts/vendor-swagger-ui.mjs). The page makes zero external
// calls (no CDN, validatorUrl disabled) and has no inline script (init lives in
// swagger-ui-init.js), so the nginx CSP stays at script-src 'self' and the docs
// work in air-gapped LANs.

function swaggerHtmlHandler(c) {
  var html = '<!DOCTYPE html>\n'
  html += '<html lang="en">\n'
  html += '<head>\n'
  html += '<meta charset="utf-8" />\n'
  html += '<meta name="viewport" content="width=device-width, initial-scale=1" />\n'
  html += '<meta name="description" content="todoless API - Swagger UI" />\n'
  html += '<title>todoless API - Swagger UI</title>\n'
  html += '<link rel="stylesheet" href="/docs/swagger-ui/swagger-ui.css" />\n'
  html += '<style>\n'
  html += '  html { box-sizing: border-box; overflow-y: scroll; }\n'
  html += '  *, *:before, *:after { box-sizing: inherit; }\n'
  html += '  body { margin: 0; background: #fafafa; }\n'
  html += '  .topbar { display: none; }\n'
  html += '  .swagger-ui .scheme-container { margin: 0; padding: 20px; }\n'
  html += '  .swagger-ui .info { margin: 20px 0; }\n'
  html += '  .swagger-ui .info .title { font-size: 28px; }\n'
  html += '  .version-badge { font-size: 12px; color: #666; padding: 10px 20px; text-align: right; }\n'
  html += '</style>\n'
  html += '</head>\n'
  html += '<body>\n'
  html += '<div class="version-badge">todoless API v1.0.1</div>\n'
  html += '<div id="swagger-ui"></div>\n'
  html += '<script src="/docs/swagger-ui/swagger-ui-bundle.js"></script>\n'
  html += '<script src="/docs/swagger-ui/swagger-ui-standalone-preset.js"></script>\n'
  html += '<script src="/docs/swagger-ui/swagger-ui-init.js"></script>\n'
  html += '</body>\n'
  html += '</html>'

  return c.html(200, html);
}

// Register both /docs and /swagger endpoints
routerAdd('GET', '/api/docs', swaggerHtmlHandler);
routerAdd('GET', '/api/swagger', swaggerHtmlHandler);