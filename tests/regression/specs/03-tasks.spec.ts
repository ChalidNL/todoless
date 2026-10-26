import { test, expect, APIRequestContext } from '@playwright/test';
import { login, QA, watchFailures } from './helpers';

const API = process.env.API_BASE_URL || 'http://127.0.0.1:8091';
const SUPERUSER = process.env.PB_SUPERUSER || 'qa-admin@todoless.local';
const SUPERUSER_PASS = process.env.PB_SUPERUSER_PASS || 'QaAdmin12345!';

/**
 * Test data is created with a superuser: the `tasks` create rule rejects a plain
 * user token (`400 Failed to create record.`), so a regular user cannot seed its
 * own fixtures. The behaviour under test (complete → persists) still runs entirely
 * through the UI with the regular QA login.
 */
async function superuserToken(request: APIRequestContext) {
  const res = await request.post(`${API}/api/collections/_superusers/auth-with-password`, {
    data: { identity: SUPERUSER, password: SUPERUSER_PASS },
  });
  expect(res.ok(), 'superuser auth for test-data setup').toBeTruthy();
  return (await res.json()).token as string;
}

async function qaUserId(request: APIRequestContext, token: string) {
  const res = await request.get(
    `${API}/api/collections/users/records?filter=` + encodeURIComponent(`email="${QA.email}"`),
    { headers: { Authorization: token } },
  );
  const items = (await res.json()).items as Array<{ id: string; family_id: string }>;
  expect(items[0]?.id, 'seeded QA user must exist').toBeTruthy();
  return items[0];
}

test.describe('task lifecycle', () => {
  test('seeded tasks are listed', async ({ page }) => {
    await login(page);
    await page.goto('/tasks');
    await expect(page.getByText('QA regression task alpha')).toBeVisible({ timeout: 20_000 });
  });

  test('completing a task removes it from the open list and persists after reload', async ({ page, request }) => {
    const token = await superuserToken(request);
    const user = await qaUserId(request, token);
    const title = `QA done ${Date.now()}`;
    const created = await request.post(`${API}/api/collections/tasks/records`, {
      headers: { Authorization: token },
      data: { title, status: 'todo', priority: 'medium', user: user.id, family_id: user.family_id },
    });
    expect(created.ok(), `task create failed: ${created.status()} ${await created.text()}`).toBeTruthy();

    const fails = watchFailures(page);
    await login(page);
    await page.goto('/tasks');
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 });

    const card = page.locator('li, article, div').filter({ hasText: title }).last();
    await card.getByRole('button', { name: /Mark as Done|Done/i }).first().click();
    await page.waitForTimeout(2500);
    await page.reload();
    await expect(page.getByText(title)).toHaveCount(0, { timeout: 20_000 });

    // and the state is really persisted in the backend
    const check = await request.get(
      `${API}/api/collections/tasks/records?filter=` + encodeURIComponent(`title="${title}"`),
      { headers: { Authorization: token } },
    );
    const items = (await check.json()).items as Array<{ status: string }>;
    expect(items[0]?.status).not.toBe('todo');
    expect(fails.fiveHundreds, `5xx: ${fails.fiveHundreds.join(', ')}`).toHaveLength(0);
  });
});
