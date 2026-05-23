/// <reference path="../pb_data/types.d.ts" />

// ── Open all collection rules for shared access ──
// Everyone can read, create, update and delete.
// Runs once at bootstrap. Wrapped in try/catch to never crash.

try {
  onBootstrap(function(app) {
    var collections = ['tasks', 'items', 'subtasks', 'labels', 'shops', 'families', 'users', 'invite_codes', 'api_tokens', 'app_settings'];
    
    for (var i = 0; i < collections.length; i++) {
      try {
        var col = app.findCollectionByNameOrId(collections[i]);
        if (col) {
          col.listRule = '';
          col.viewRule = '';
          col.createRule = '';
          col.updateRule = '';
          col.deleteRule = '';
          app.save(col);
          console.log('PUBLIC_RULES: opened ' + collections[i]);
        }
      } catch(err) {
        console.log('PUBLIC_RULES: skipped ' + collections[i] + ' (' + String(err) + ')');
      }
    }
  });
} catch(e) {
  console.log('PUBLIC_RULES: onBootstrap failed: ' + String(e));
}
