import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('manifest is installable and every icon resolves with the declared size', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({ id: '/', start_url: '/', scope: '/', display: 'standalone', name: 'todoless' });
  const purposes = manifest.icons.map((icon: { purpose?: string }) => icon.purpose);
  expect(purposes).toContain('any');
  expect(purposes).toContain('maskable');
  for (const icon of manifest.icons as Array<{ src: string; sizes: string }>) {
    const res = await request.get(icon.src);
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
    const body = await res.body();
    // PNG IHDR: width/height at bytes 16..24.
    const [w, h] = [body.readUInt32BE(16), body.readUInt32BE(20)];
    expect(`${w}x${h}`, icon.src).toBe(icon.sizes);
  }
  for (const path of ['/favicon.ico', '/icons/apple-touch-icon.png', '/icons/logo-mark.png']) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/apple-touch-icon.png');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
});

test('service worker controls the app, keeps /api/docs out of the SPA fallback and launches offline', async ({ page, context }) => {
  await login(page);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // Installed-PWA regression: with the SW in control, navigating to the docs
  // must reach the server (Swagger UI), not the cached app shell.
  await page.goto('/api/docs');
  await expect(page).toHaveTitle(/Swagger UI/);
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0);

  // Offline cold start: the shell comes from the precache and the user gets
  // an honest "offline" state with a retry — not a fake empty app.
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('alert')).toContainText(/offline/i);
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
});

test('a failing backend shows an error state instead of an empty app', async ({ page }) => {
  await login(page);
  await page.route('**/api/bootstrap', (route) => route.fulfill({ status: 500, body: '{}' }));
  await page.route('**/api/collections/**/records**', (route) => route.fulfill({ status: 500, body: '{"message":"boom"}' }));
  await page.reload();
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/server/i);
  await expect(alert).not.toContainText('boom');
});

test('an expired session sends the user to login instead of a dead-end error', async ({ page }) => {
  await login(page);
  await page.route('**/api/bootstrap', (route) => route.fulfill({ status: 401, body: '{}' }));
  await page.route('**/api/collections/**/records**', (route) => route.fulfill({ status: 401, body: '{}' }));
  await page.reload();
  await expect(page.locator('#login-email')).toBeVisible();
});
