import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../../..');

describe('PocketBase family sharing rules', () => {
  it('ships a migration that lets family members view non-private tasks', () => {
    const migrationsDir = resolve(root, 'pb_migrations');
    const migrationFile = readdirSync(migrationsDir).find((name) =>
      /family.*task.*rule|task.*family.*rule/i.test(name),
    );

    expect(migrationFile, 'expected a dedicated task family sharing migration').toBeTruthy();

    const migrationPath = resolve(migrationsDir, migrationFile ?? '');
    expect(existsSync(migrationPath)).toBe(true);

    const content = readFileSync(migrationPath, 'utf8');
    const expectedRule = 'user = @request.auth.id || (is_private = false && user.family_id = @request.auth.family_id)';

    expect(content).toContain('tasks');
    expect(content).toContain(`collection.listRule = '${expectedRule}'`);
    expect(content).toContain(`collection.viewRule = '${expectedRule}'`);
    expect(content).toContain("collection.updateRule = 'user = @request.auth.id'");
    expect(content).toContain("collection.deleteRule = 'user = @request.auth.id'");
  });
});
