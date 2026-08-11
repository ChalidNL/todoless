/// <reference path="../pb_data/types.d.ts" />

// A required boolean rejects false as blank in PocketBase validation, making
// revocation impossible to persist. Existing installs need an explicit schema
// upgrade because the original agent_keys migration is already applied.
migrate(
  function(app) {
    var keys = app.findCollectionByNameOrId('agent_keys');
    var activeField = keys.fields.getByName('active');
    activeField.required = false;
    app.save(keys);
  },
  function(app) {
    var keys = app.findCollectionByNameOrId('agent_keys');
    var activeField = keys.fields.getByName('active');
    activeField.required = true;
    app.save(keys);
  },
);
