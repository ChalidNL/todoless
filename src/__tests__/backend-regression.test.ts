import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('backend regression guards', () => {
  it('allows family members to update shared shops they can see', () => {
    const migration = repoFile('pb_migrations/054_family_shop_write_rules.js');

    expect(migration).toContain("shops.updateRule = familyRule");
    expect(migration).toContain("shops.deleteRule = familyRule");
    expect(migration).toContain("user.family_id = @request.auth.family_id");
  });

  it('uses a fresh auth record for member role and block actions', () => {
    const hook = repoFile('pb_hooks/main.pb.js');

    expect(hook).toContain('function _freshAuth()');
    expect(hook).toContain('var actorRoleRecord = _freshAuth()');
    expect(hook).toContain('var actorBlockRecord = _freshAuth()');
    expect(hook).toContain('Cannot demote the owner');
  });

  it('loads projects and reminders with fields that exist in their PocketBase schemas', () => {
    const client = repoFile('src/lib/pocketbase-client.ts');

    expect(client).toContain("pb.collection('projects').getFullList({ filter: `user = \"${userId}\"` })");
    expect(client).toContain("pb.collection('reminders').getFullList({ filter: `user = \"${userId}\"`, sort: 'reminder_time' })");
    expect(client).not.toContain("pb.collection('projects').getFullList({ filter: `user.id = \"${userId}\"`, sort: '-created' })");
    expect(client).not.toContain("pb.collection('reminders').getFullList({ filter: `user.id = \"${userId}\"`, sort: 'due_date' })");
  });

  it('supplies the required default priority when quick-adding a task', () => {
    const client = repoFile('src/lib/pocketbase-client.ts');

    expect(client).toContain("priority: task.priority || 'medium'");
  });

  it('allows family members to update and delete visible shared tasks', () => {
    const migration = repoFile('pb_migrations/z066_family_shared_task_write_rules.js');

    expect(migration).toContain('tasks.updateRule = TASK_FAMILY_WRITE_RULE');
    expect(migration).toContain('tasks.deleteRule = TASK_FAMILY_WRITE_RULE');
    expect(migration).toContain('is_private = false');
    expect(migration).toContain('user.family_id = @request.auth.family_id');
    expect(migration).toContain('label:length = 0');
  });
});
