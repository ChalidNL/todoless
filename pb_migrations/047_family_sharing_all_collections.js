migrate(
  (app) => {
    // Definitive family rule: owner sees all, family sees non-private
    const familyRule = 'user = @request.auth.id || (is_private = false && user.family_id = @request.auth.family_id)';
    // Collections without is_private field — all family members see everything
    const openRule = 'user = @request.auth.id || user.family_id = @request.auth.family_id';

    // All collections that should be family-shared. Skip: users, families, agents, api_tokens, invite_codes, app_settings
    const collections = ['tasks', 'items', 'notes', 'labels', 'shops', 'calendar_events', 'sprints', 'goals', 'projects', 'rewards', 'reminders', 'briefings'];

    for (var i = 0; i < collections.length; i++) {
      try {
        var col = app.findCollectionByNameOrId(collections[i]);
        if (!col) continue;

        // Determine which rule to use based on whether is_private field exists
        var hasPrivate = false;
        try { hasPrivate = !!col.fields.getByName('is_private'); } catch(e) {}
        var rule = hasPrivate ? familyRule : openRule;

        col.listRule = rule;
        col.viewRule = rule;
        app.save(col);
      } catch(e) {
        // Collection might not exist — skip
      }
    }
  },
  (app) => {
    // Revert to owner-only rules
    var ownerRule = 'user = @request.auth.id';
    var collections = ['tasks', 'items', 'notes', 'labels', 'shops', 'calendar_events', 'sprints', 'goals', 'projects', 'rewards', 'reminders', 'briefings'];
    for (var i = 0; i < collections.length; i++) {
      try {
        var col = app.findCollectionByNameOrId(collections[i]);
        if (!col) continue;
        col.listRule = ownerRule;
        col.viewRule = ownerRule;
        app.save(col);
      } catch(e) {}
    }
  },
);
