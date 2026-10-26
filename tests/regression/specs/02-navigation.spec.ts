import { test, expect } from '@playwright/test';
import { login, watchFailures } from './helpers';

const ROUTES: Array<{ path: string; expect: RegExp }> = [
  { path: '/', expect: /INBOX|Inbox is empty/i },
  { path: '/tasks', expect: /TAKEN|A-Z|Priority/i },
  { path: '/calendar', expect: /AGENDA|Schedule|Week/i },
  { path: '/groceries', expect: /SHOP|No items yet|A-Z/i },
  { path: '/settings', expect: /SETTINGS|Preferences|Family/i },
];

test.describe('route health', () => {
  for (const route of ROUTES) {
    test(`${route.path} renders content without 5xx`, async ({ page }) => {
      const fails = watchFailures(page);
      await login(page);
      fails.fiveHundreds.length = 0;

      await page.goto(route.path);
      await expect(page.locator('body')).toContainText(route.expect, { timeout: 20_000 });
      // A permanent "Loading..." string means the view never resolved.
      await expect
        .poll(async () => (await page.locator('body').innerText()).trim(), { timeout: 15_000 })
        .not.toBe('Loading...');

      expect(fails.fiveHundreds, `5xx on ${route.path}: ${fails.fiveHundreds.join(', ')}`).toHaveLength(0);
      expect(fails.pageErrors, `uncaught errors on ${route.path}: ${fails.pageErrors.join(' | ')}`).toHaveLength(0);
    });
  }

  test('bottom navigation reaches every primary tab', async ({ page }) => {
    await login(page);
    for (const label of ['Taken', 'Agenda', 'Shop', 'Instellingen']) {
      const tab = page.getByRole('link', { name: new RegExp(label, 'i') }).first();
      if ((await tab.count()) === 0) continue;
      await tab.click();
      await page.waitForTimeout(1500);
      expect(page.url()).not.toContain('/login');
    }
  });
});
