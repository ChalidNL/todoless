import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildPwaManifest } from '@/config/pwa-manifest';

const REGULAR_OPTS = { isBeta: false, iconDir: '/icons', appName: 'todoless', appShort: 'todoless' };
const BETA_OPTS = {
  isBeta: true,
  iconDir: '/icons-beta',
  appName: 'todoless β',
  appShort: 'todoless β',
};

describe('PWA configuration', () => {
  it('builds an installable web manifest with required icons', () => {
    const manifest = buildPwaManifest(REGULAR_OPTS);

    expect(manifest.name).toBe('todoless');
    expect(manifest.short_name).toBe('todoless');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');

    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  it('beta manifest uses the beta icon directory and app name', () => {
    const manifest = buildPwaManifest(BETA_OPTS);

    expect(manifest.name).toContain('β');
    expect(manifest.icons.every((icon) => icon.src.startsWith('/icons-beta/'))).toBe(true);
  });

  it('index.html declares no static manifest link (VitePWA injects the only one at build)', () => {
    const html = readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');

    // GH-93 regression guard: static <link rel="manifest"> tags caused a third,
    // build-injected manifest link to appear in the built index.html.
    expect(html).not.toContain('<link rel="manifest"');
  });
});