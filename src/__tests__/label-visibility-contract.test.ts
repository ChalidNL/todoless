import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('label based visibility contract', () => {
  const migration = readFileSync(resolve(__dirname, '../../pb_migrations/z061_label_visibility.js'), 'utf8');
  const types = readFileSync(resolve(__dirname, '../types/index.ts'), 'utf8');
  const pbClient = readFileSync(resolve(__dirname, '../lib/pocketbase-client.ts'), 'utf8');
  const apiClient = readFileSync(resolve(__dirname, '../lib/api-client.ts'), 'utf8');

  it('adds label visibility fields and a single task label relation', () => {
    expect(migration).toContain("name: 'visibility'");
    expect(migration).toContain("values: ['private', 'shared', 'family']");
    expect(migration).toContain("name: 'owner'");
    expect(migration).toContain("name: 'shared_with'");
    expect(migration).toContain("name: 'family'");
    expect(migration).toContain("name: 'label'");
    expect(migration).toContain('maxSelect: 1');
  });

  it('documents unlabeled tasks as family visible and enforces label visibility in task rules', () => {
    expect(migration).toContain('Unlabeled tasks are family-visible');
    expect(migration).toContain('label = ""');
    expect(migration).toContain('label.visibility = "family"');
    expect(migration).toContain('label.visibility = "shared"');
    expect(migration).toContain('label.visibility = "private"');
    expect(migration).toContain('label.shared_with ?= @request.auth.id');
  });

  it('exposes label visibility fields in frontend types and both API clients', () => {
    expect(types).toContain("export type LabelVisibility = 'private' | 'shared' | 'family'");
    expect(types).toContain('visibility: LabelVisibility');
    expect(types).toContain('sharedWith?: string[]');
    for (const source of [pbClient, apiClient]) {
      expect(source).toMatch(/visibility:\s*(record|r)\.visibility/);
      expect(source).toMatch(/sharedWith:\s*Array\.isArray\((record|r)\.shared_with\)/);
      expect(source).toMatch(/labelId:\s*(record|r)\.label/);
      expect(source).toMatch(/label:\s*(task|data)\.labelId/);
    }
  });
});
