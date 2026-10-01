import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_UI_LANGUAGES, t } from '../i18n/translations';

/**
 * Every literal `t('namespace.key')` used by production source must resolve in
 * every supported UI language. Unresolved keys fall through `t()` and render as
 * raw dotted keys (e.g. "onboarding.firstNamePlaceholder" as an input
 * placeholder), which is what this test guards against.
 */
const SRC_DIR = path.resolve(__dirname, '..');

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (entry === '__tests__') return [];
    if (statSync(full).isDirectory()) return collectSourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts') ? [full] : [];
  });
}

function collectKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  const key = `['"]([a-zA-Z0-9_]+\\.[a-zA-Z0-9_.]+)['"]`;
  const patterns = [
    // t('ns.key')
    new RegExp(`\\bt\\(\\s*${key}`, 'g'),
    // t(cond ? 'ns.a' : 'ns.b')
    new RegExp(`\\bt\\(\\s*[^'"()]+\\?\\s*${key}\\s*:\\s*${key}`, 'g'),
  ];
  for (const file of collectSourceFiles(SRC_DIR)) {
    const source = readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        for (const found of match.slice(1).filter(Boolean)) {
          if (!keys.has(found)) keys.set(found, path.relative(SRC_DIR, file));
        }
      }
    }
  }
  return keys;
}

describe('i18n: every key used in source resolves', () => {
  const keys = collectKeys();

  it('finds translation keys to check', () => {
    expect(keys.size).toBeGreaterThan(100);
  });

  for (const language of SUPPORTED_UI_LANGUAGES) {
    it(`resolves all keys in ${language}`, () => {
      const unresolved = [...keys.entries()]
        .filter(([key]) => t(key, language) === key)
        .map(([key, file]) => `${key} (${file})`);
      expect(unresolved).toEqual([]);
    });
  }
});
