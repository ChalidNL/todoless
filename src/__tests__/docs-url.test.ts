import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_DOCS_URL, resolveDocsUrl } from '../lib/docs-url';

describe('API documentation link', () => {
  it('defaults to the same-origin Swagger UI served by every install', () => {
    expect(resolveDocsUrl(undefined)).toBe('/api/docs');
    expect(resolveDocsUrl('   ')).toBe(DEFAULT_DOCS_URL);
  });

  it('accepts public documentation on the todoless website', () => {
    expect(resolveDocsUrl('https://todoless.example/docs/api')).toBe('https://todoless.example/docs/api');
    expect(resolveDocsUrl('/docs/api')).toBe('/docs/api');
  });

  it('rejects unsafe or malformed values instead of rendering them', () => {
    for (const value of ['javascript:alert(1)', 'data:text/html,hi', '//evil.example/docs', 'not a url', 'ftp://host/docs']) {
      expect(resolveDocsUrl(value)).toBe(DEFAULT_DOCS_URL);
    }
  });

  it('never ships a hardcoded private-LAN docs address', () => {
    const settings = readFileSync(path.resolve(__dirname, '../components/Settings.tsx'), 'utf8');
    expect(settings).not.toMatch(/192\.168\.|10\.\d+\.\d+\.\d+|localhost:\d+/);
  });

  it('keeps server routes out of the service worker SPA fallback', () => {
    // Without the denylist the installed PWA answered /api/docs with index.html
    // and the docs link bounced back to the app home screen.
    const viteConfig = readFileSync(path.resolve(__dirname, '../../vite.config.ts'), 'utf8');
    expect(viteConfig).toContain('navigateFallbackDenylist: [/^\\/api\\//, /^\\/_\\//, /^\\/docs\\//]');
  });
});
