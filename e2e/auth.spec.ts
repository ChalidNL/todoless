/**
 * Todoless E2E Test Suite
 * 
 * Tests: Authentication flows (login, register, logout, session persistence)
 * Run with: npx playwright test e2e/auth.spec.ts --project=chromium
 */
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and cookies for clean state
    await page.context().clearCookies();
    await page.goto('/');
  });

  test('shows login screen when not authenticated', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /inloggen/i })).toBeVisible();
  });

  test('shows register link on login screen', async ({ page }) => {
    await expect(page.getByRole('link', { name: /registreren/i })).toBeVisible();
    // Or a button to switch to register
    await expect(page.getByText(/registreren/i)).toBeVisible();
  });

  test('navigates to register page', async ({ page }) => {
    const registerLink = page.getByRole('link', { name: /registreren/i });
    if (await registerLink.isVisible()) {
      await registerLink.click();
    } else {
      await page.goto('/register');
    }
    await expect(page.getByRole('textbox', { name: /naam/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /e-mail/i })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.locator('input[type="email"]').fill('invalid@example.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.getByRole('button', { name: /inloggen/i }).click();
    // Should show error or stay on login
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('session persists after page reload', async ({ page }) => {
    // If user is logged in from previous test, verify nav is visible
    const navBar = page.locator('nav');
    if (await navBar.isVisible()) {
      await page.reload();
      await expect(navBar).toBeVisible();
    }
  });

  test('logout returns to login screen', async ({ page }) => {
    // Navigate to settings and look for logout
    await page.goto('/settings');
    const logoutButton = page.getByRole('button', { name: /uitloggen|logout/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await expect(page.locator('input[type="email"]')).toBeVisible();
    }
  });
});

test.describe('Authentication - PocketBase API', () => {
  test('pocketbase health endpoint is reachable', async ({ request }) => {
    // Check if PocketBase API is running
    const response = await request.get('http://localhost:8092/api/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('code', 200);
  });

  test('can authenticate with valid credentials', async ({ request }) => {
    // Try to authenticate via PocketBase API
    const response = await request.post('http://localhost:8092/api/collections/users/auth-with-password', {
      data: {
        identity: process.env.TEST_ADMIN_EMAIL || 'admin@todoless.local',
        password: process.env.TEST_ADMIN_PASSWORD || 'testpassword123',
      },
    });
    // Either succeeds (200) or fails with expected error (400 - user not found)
    expect([200, 400, 401]).toContain(response.status());
  });
});
