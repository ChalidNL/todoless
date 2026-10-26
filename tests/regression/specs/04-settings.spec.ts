import { test, expect } from '@playwright/test';
import { login, watchFailures } from './helpers';

const PAGES: Array<{ path: string; text: RegExp }> = [
  { path: '/settings/members', text: /FAMILY|Family/i },
  { path: '/settings/labels', text: /LABELS|Labels/i },
  { path: '/settings/shops', text: /SHOPS|Shops|Winkels/i },
  { path: '/settings/notifications', text: /NOTIFICATION|Notificat/i },
  { path: '/settings/preferences', text: /Preferences|Voorkeuren/i },
];

test.describe('settings sub-pages never dead-end', () => {
  for (const p of PAGES) {
    test(`${p.path} renders real content (not a stuck loader)`, async ({ page }) => {
      const fails = watchFailures(page);
      await login(page);
      fails.fiveHundreds.length = 0;
      await page.goto(p.path);

      await expect(page.locator('body')).toContainText(p.text, { timeout: 20_000 });
      // A stuck loader is the classic silent failure in this app: assert we are
      // no longer showing only a loading placeholder.
      await expect
        .poll(
          async () => {
            const t = (await page.locator('body').innerText()).trim();
            return /^(Loading\.\.\.|LOADING\.\.\.)$/i.test(t);
          },
          { timeout: 20_000, message: 'page stayed on a loading placeholder' },
        )
        .toBe(false);

      expect(fails.fiveHundreds, `5xx on ${p.path}: ${fails.fiveHundreds.join(', ')}`).toHaveLength(0);
      expect(fails.pageErrors, `uncaught errors on ${p.path}: ${fails.pageErrors.join(' | ')}`).toHaveLength(0);
    });
  }
});
