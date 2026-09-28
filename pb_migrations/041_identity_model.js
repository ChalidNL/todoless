/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    // 1. Add member_type field
    if (!users.fields.getByName('member_type')) {
      users.fields.add(new SelectField({
        name: 'member_type',
        values: ['human', 'agent'],
        maxSelect: 1,
        required: true,
      }));
    }

    // 2. Add member_status field  
    if (!users.fields.getByName('member_status')) {
      users.fields.add(new SelectField({
        name: 'member_status',
        values: ['pending_approval', 'active', 'blocked'],
        maxSelect: 1,
        required: true,
      }));
    }

    // 3. Update role values to new set
    const roleField = users.fields.getByName('role');
    if (roleField) {
      roleField.values = ['owner', 'admin', 'member', 'agent'];
    }

    // 4. Migrate existing data
    const allUsers = app.findRecordsByFilter('users', '', '', 0, 0);
    for (const u of allUsers) {
      let changed = false;

      // Set member_type
      if (!u.get('member_type')) {
        const agentStatus = u.get('agent_status') || '';
        if (agentStatus === 'pending' || agentStatus === 'approved' || agentStatus === 'rejected') {
          u.set('member_type', 'agent');
        } else {
          u.set('member_type', 'human');
        }
        changed = true;
      }

      // Set member_status
      if (!u.get('member_status')) {
        const agentStatus = u.get('agent_status') || '';
        if (agentStatus === 'pending') {
          u.set('member_status', 'pending_approval');
        } else if (agentStatus === 'rejected') {
          u.set('member_status', 'blocked');
        } else {
          u.set('member_status', 'active');
        }
        changed = true;
      }

      // Migrate old role to new role
      const oldRole = String(u.get('role') || '');
      if (oldRole === 'user' || oldRole === 'assistant' || oldRole === 'child') {
        u.set('role', 'member');
        changed = true;
      } else if (oldRole === 'admin') {
        // First admin detected = owner; subsequent admins stay admin
        const otherAdmins = app.findRecordsByFilter('users', 'role = "admin" && id != "' + u.id + '"', '', 1, 0);
        if (otherAdmins.length === 0) {
          u.set('role', 'owner');
        } else {
          u.set('role', 'admin');
        }
        changed = true;
      }

      if (changed) {
        app.save(u);
      }
    }

    // 5. Clean up old agent_status field
    const oldStatusField = users.fields.getByName('agent_status');
    if (oldStatusField) {
      users.fields.removeById(oldStatusField.id);
    }

    app.save(users);

    // 6. Update api_tokens collection: add token_type
    try {
      const tokens = app.findCollectionByNameOrId('api_tokens');
      if (!tokens.fields.getByName('token_type')) {
        tokens.fields.add(new SelectField({
          name: 'token_type',
          values: ['agent_api_token', 'personal_api_token'],
          maxSelect: 1,
          required: true,
        }));
        // Set existing tokens to agent_api_token by default
        app.save(tokens);
        const existingTokens = app.findRecordsByFilter('api_tokens', '', '', 0, 0);
        for (const t of existingTokens) {
          if (!t.get('token_type')) {
            t.set('token_type', 'agent_api_token');
            app.save(t);
          }
        }
      }
    } catch(e) {
      console.log('api_tokens collection not found, skipping:', String(e));
    }
  },
  (app) => {
    // Rollback
    try {
      const users = app.findCollectionByNameOrId('users');

      const memberTypeField = users.fields.getByName('member_type');
      if (memberTypeField) users.fields.removeById(memberTypeField.id);

      const memberStatusField = users.fields.getByName('member_status');
      if (memberStatusField) users.fields.removeById(memberStatusField.id);

      const roleField = users.fields.getByName('role');
      if (roleField) roleField.values = ['admin', 'user', 'assistant', 'child'];

      // Restore agent_status
      if (!users.fields.getByName('agent_status')) {
        users.fields.add(new SelectField({
          name: 'agent_status',
          values: ['pending', 'approved', 'rejected'],
          maxSelect: 1,
        }));
      }

      app.save(users);

      // Rollback api_tokens
      const tokens = app.findCollectionByNameOrId('api_tokens');
      const tokenTypeField = tokens.fields.getByName('token_type');
      if (tokenTypeField) tokens.fields.removeById(tokenTypeField.id);
      app.save(tokens);
    } catch(e) {
      console.log('rollback error:', String(e));
    }
  },
);
