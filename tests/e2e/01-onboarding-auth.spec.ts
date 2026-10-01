import { expect, test } from '@playwright/test';
import { ADMIN, expectNoHorizontalOverflow, login } from './helpers';

test.describe.configure({ mode: 'serial' });

test('fresh install: admin onboarding creates the account and opens the app', async ({ page }) => {
  await page.goto('/');

  // Language step
  await expect(page.getByRole('heading', { name: 'Choose your language' })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'onboarding language');
  await page.getByRole('button', { name: /English/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  // "Skip" during first-run setup must never bypass account creation: it jumps
  // to the workspace step instead of completing onboarding without an admin.
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByLabel('Workspace name')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0);

  // Workspace validation, then the account step
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('Workspace name').fill(ADMIN.family);
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByLabel('First name', { exact: false })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'onboarding account');
  // No raw i18n keys as placeholders.
  for (const input of await page.locator('input').all()) {
    expect(await input.getAttribute('placeholder') ?? '').not.toMatch(/^[a-z]+\.[a-zA-Z.]+$/);
  }
  await page.getByLabel('First name', { exact: false }).fill(ADMIN.firstName);
  await page.getByLabel('Last name').fill(ADMIN.lastName);
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);

  // Mismatched confirmation is rejected client-side.
  await page.getByLabel('Confirm password').fill(`${ADMIN.password}x`);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toContainText(/match/i);

  await page.getByLabel('Confirm password').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('button', { name: 'Open todoless' }).click();

  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await expect(page.getByText('INBOX', { exact: true })).toBeVisible();

  // Setup is now complete on the server.
  const status = await page.request.get('/api/setup-status');
  expect(await status.json()).toMatchObject({ has_users: true, setup_complete: true });
});

test('session persists across reloads and deep links', async ({ page }) => {
  await login(page);
  await page.goto('/groceries');
  await expect(page.getByText('GROCERIES', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('GROCERIES', { exact: true })).toBeVisible();
  // Unknown deep links land on the app, not onboarding.
  await page.goto('/this/does/not/exist');
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
});

test('wrong credentials show an error and do not sign in', async ({ page }) => {
  await page.goto('/');
  const goToLogin = page.getByRole('button', { name: 'Go to login' });
  await expect(goToLogin.or(page.locator('#login-email')).first()).toBeVisible();
  if (await goToLogin.isVisible()) await goToLogin.click();
  await page.locator('#login-email').fill(ADMIN.email);
  await page.locator('#login-password').fill('definitely-wrong');
  // Enter submits the form (mobile keyboard "Go").
  await page.locator('#login-password').press('Enter');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0);

  // Empty submit is validated without a request.
  await page.locator('#login-password').fill('');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
});

test('logout returns to login and a new login restores the session', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /Log out/i }).click();
  await expect(page.locator('#login-email')).toBeVisible();
  // Protected routes are not reachable after logout.
  await page.goto('/tasks');
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0);
  await login(page);
  await expect(page.getByText('INBOX', { exact: true })).toBeVisible();
});
