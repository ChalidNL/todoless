import { test, expect } from '@playwright/test';
import { login, passFirstRunGate, QA, watchFailures } from './helpers';

test.describe('first-run onboarding + authentication', () => {
  test('language gate → tour → login screen (no dead end)', async ({ page }) => {
    const fails = watchFailures(page);
    await page.goto('/');
    await expect(page.getByText('Choose your language')).toBeVisible({ timeout: 15_000 });

    const nextBtn = page.getByRole('button', { name: /^Next$/i }).first();
    for (let i = 0; i < 6 && !(await nextBtn.isEnabled()); i++) {
      await page.getByRole('button', { name: /English/i }).first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
    await expect(nextBtn).toBeEnabled({ timeout: 10_000 });
    await nextBtn.click();
    // The tour must offer a way out and land on a usable screen.
    const exit = page.getByRole('button', { name: /^(Go to login|Skip)$/i }).first();
    await expect(exit).toBeVisible({ timeout: 10_000 });
    await exit.click();

    await expect(page.locator('#login-email')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#login-password')).toBeVisible();
    expect(fails.fiveHundreds, `5xx during first run: ${fails.fiveHundreds.join(', ')}`).toHaveLength(0);
    expect(fails.pageErrors, `uncaught errors: ${fails.pageErrors.join(' | ')}`).toHaveLength(0);
  });

  test('login with seeded user reaches the app shell', async ({ page }) => {
    const fails = watchFailures(page);
    await login(page);
    // login() already asserted the shell text; here we assert we are really outside
    // the login screen and the primary navigation is interactive (app shell).
    expect(page.url()).not.toContain('/login');
    await expect(page.locator('nav, [role="navigation"]').first()).toBeVisible({ timeout: 15_000 });
    expect(fails.fiveHundreds, `5xx after login: ${fails.fiveHundreds.join(', ')}`).toHaveLength(0);
  });

  test('wrong password shows an error and does NOT enter the app', async ({ page }) => {
    await page.goto('/');
    await passFirstRunGate(page);
    await page.locator('#login-email').waitFor({ state: 'visible', timeout: 15_000 });
    await page.fill('#login-email', QA.email);
    await page.fill('#login-password', 'definitely-wrong-password-123');
    await page.getByRole('button', { name: /^Log In$/i }).first().click();
    await page.waitForTimeout(3000);

    // The user must not be inside the app ...
    await expect(page.getByText(/INBOX/i).first()).toHaveCount(0);
    // ... and must get visible feedback instead of a silent no-op.
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/invalid|incorrect|failed|wrong|error|ongeldig|verkeerd/i);
  });
});
