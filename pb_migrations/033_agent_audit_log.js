/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const agentKeys = app.findCollectionByNameOrId('agent_keys');

    const collection = new Collection({
      name: 'agent_audit_log',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'agent_key_id',
          type: 'relation',
          required: true,
          collectionId: agentKeys.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'agent_name',
          type: 'text',
          required: false,
        },
        {
          name: 'action',
          type: 'select',
          required: true,
          values: [
            'key_generate', 'key_revoke',
            'create', 'read', 'update', 'delete',
            'complete', 'assign', 'set_labels', 'set_due_date',
          ],
          maxSelect: 1,
        },
        {
          name: 'entity_type',
          type: 'text',
          required: false,
        },
        {
          name: 'entity_id',
          type: 'text',
          required: false,
        },
        {
          name: 'details',
          type: 'json',
          required: false,
        },
        {
          name: 'ip_address',
          type: 'text',
          required: false,
        },
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'created',
          type: 'date',
          required: false,
        },
      ],
      indexes: [
        'CREATE INDEX `idx_audit_log_action` ON `agent_audit_log` (`action`)',
        'CREATE INDEX `idx_audit_log_created` ON `agent_audit_log` (`created`)',
        'CREATE INDEX `idx_audit_log_agent` ON `agent_audit_log` (`agent_key_id`)',
      ],
    });

    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('agent_audit_log');
      app.delete(collection);
    } catch {}
  },
);