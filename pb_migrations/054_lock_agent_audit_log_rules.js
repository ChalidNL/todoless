migrate(
  function(app) {
    var col = app.findCollectionByNameOrId('agent_audit_log');
    col.createRule = null;
    col.updateRule = null;
    col.deleteRule = null;
    app.save(col);
  },
  function(app) {
    var col = app.findCollectionByNameOrId('agent_audit_log');
    col.createRule = '';
    col.updateRule = '';
    col.deleteRule = '';
    app.save(col);
  }
);
