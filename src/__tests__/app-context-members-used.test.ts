import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// #255: every member the app context hands out has a caller. knip can't see
// this (it works per file, and AppContext.tsx is imported for other reasons),
// so 32 operations had piled up that nothing used.
const ROOT = join(__dirname, '..');

// Read by tests only: the scope state the GH#76 boot-race test observes.
const ALLOWED_WITHOUT_CALLER = new Set(['sharedView']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('AppContext members (#255)', () => {
  it('has a caller outside AppContext.tsx for every member', () => {
    const contextSource = readFileSync(join(ROOT, 'context/AppContext.tsx'), 'utf8');
    const body = contextSource.slice(contextSource.indexOf('interface AppContextType'));
    const members = [...body.slice(0, body.indexOf('\n}')).matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]);
    expect(members.length).toBeGreaterThan(40);

    const others = sourceFiles(ROOT)
      .filter((path) => !path.endsWith(join('context', 'AppContext.tsx')))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    const unused = members.filter((name) => !ALLOWED_WITHOUT_CALLER.has(name) && !new RegExp(`\\b${name}\\b`).test(others));
    expect(unused).toEqual([]);
  });
});
