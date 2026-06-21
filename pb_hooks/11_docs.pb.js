/// <reference path="../../pb_data/types.d.ts" />

// Swagger UI HTML page for interactive API exploration
// Served at: GET /api/docs

function swaggerHtmlHandler(c) {
  var html = '<!DOCTYPE html>\n'
  html += '<html lang="en">\n'
  html += '<head>\n'
  html += '<meta charset="utf-8" />\n'
  html += '<meta name="viewport" content="width=device-width, initial-scale=1" />\n'
  html += '<meta name="description" content="todoless API - Swagger UI" />\n'
  html += '<title>todoless API - Swagger UI</title>\n'
  html += '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />\n'
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
  html += '<div class="version-badge">todoless API v1.0.0</div>\n'
  html += '<div id="swagger-ui"></div>\n'
  html += '<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>\n'
  html += '<script>\n'
  html += '  SwaggerUIBundle({\n'
  html += '    url: "/api/openapi.json",\n'
  html += '    dom_id: "#swagger-ui",\n'
  html += '    deepLinking: true,\n'
  html += '    presets: [\n'
  html += '      SwaggerUIBundle.presets.apis,\n'
  html += '      SwaggerUIBundle.SwaggerUIStandalonePreset\n'
  html += '    ],\n'
  html += '    layout: "StandaloneLayout",\n'
  html += '    defaultModelsExpandDepth: 1,\n'
  html += '    defaultModelExpandDepth: 1,\n'
  html += '    docExpansion: "list",\n'
  html += '    filter: true,\n'
  html += '    showExtensions: true,\n'
  html += '    tryItOutEnabled: true,\n'
  html += '    requestSnippets: {\n'
  html += '      generators: {\n'
  html += '        "curl_bash": { title: "cURL (bash)", syntax: "bash" },\n'
  html += '        "curl_powershell": { title: "cURL (PowerShell)", syntax: "powershell" },\n'
  html += '        "curl_cmd": { title: "cURL (CMD)", syntax: "bash" },\n'
  html += '      },\n'
  html += '      defaultExpanded: true,\n'
  html += '      languages: ["curl_bash", "curl_powershell"],\n'
  html += '    },\n'
  html += '  });\n'
  html += '</script>\n'
  html += '</body>\n'
  html += '</html>'

  return c.html(200, html);
}

// Register both /docs and /swagger endpoints
routerAdd('GET', '/api/docs', swaggerHtmlHandler);
routerAdd('GET', '/api/swagger', swaggerHtmlHandler);
