import { expect, test, type APIRequestContext } from '@playwright/test';
import { ADMIN, login } from './helpers';

/**
 * #77: realtime events from another family member are applied to the open
 * screen without refetching the lists, and the owner's own private task never
 * disappears when someone else changes something (it used to: the refetch
 * after an event filtered out every private task, including your own).
 */
const OWN_PRIVATE = 'E2E realtime own private task';
const LIVE_TASK = 'E2E realtime task from member';

async function auth(request: APIRequestContext, identity: string, password: string) {
  const res = await request.post('/api/collections/users/auth-with-password', { data: { identity, password } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return { headers: { Authorization: `Bearer ${body.token}` }, id: body.record.id as string };
}

test('changes by another member appear live, without refetching, and own private tasks stay', async ({ page, request }) => {
  const admin = await auth(request, ADMIN.email, ADMIN.password);
  const invite = await request.post('/api/invites/create', { headers: admin.headers, data: { type: 'human' } });
  const { code } = await invite.json();
  const memberEmail = `e2e-realtime-${Date.now()}@example.com`;
  const register = await request.post('/api/register', {
    data: { email: memberEmail, password: 'Member-Passw0rd!', passwordConfirm: 'Member-Passw0rd!', name: 'Rita Realtime', invite_code: code },
  });
  expect(register.status()).toBe(201);
  const member = await auth(request, memberEmail, 'Member-Passw0rd!');

  await request.post('/api/collections/tasks/records', {
    headers: admin.headers,
    data: { title: OWN_PRIVATE, status: 'todo', is_private: true, user: admin.id },
  });

  await login(page);
  await page.getByRole('link', { name: 'Tasks' }).click();
  await expect(page.getByText(OWN_PRIVATE)).toBeVisible();
  await page.waitForTimeout(1500); // realtime subscription established

  const listFetches: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (req.method() === 'GET' && /\/api\/(collections\/(tasks|items)\/records|entries|bootstrap)/.test(url)) listFetches.push(url);
  });

  const created = await request.post('/api/collections/tasks/records', {
    headers: member.headers,
    data: { title: LIVE_TASK, status: 'todo', is_private: false, user: member.id },
  });
  expect(created.ok()).toBeTruthy();
  const { id } = await created.json();

  await expect(page.getByText(LIVE_TASK)).toBeVisible();
  await expect(page.getByText(OWN_PRIVATE)).toBeVisible();

  const renamed = await request.patch(`/api/collections/tasks/records/${id}`, { headers: member.headers, data: { title: `${LIVE_TASK} (renamed)` } });
  expect(renamed.ok(), await renamed.text()).toBeTruthy();
  await expect(page.getByText(`${LIVE_TASK} (renamed)`)).toBeVisible();

  await request.delete(`/api/collections/tasks/records/${id}`, { headers: member.headers });
  await expect(page.getByText(`${LIVE_TASK} (renamed)`)).toHaveCount(0);
  await expect(page.getByText(OWN_PRIVATE)).toBeVisible();

  expect(listFetches, 'realtime events must not trigger list refetches').toEqual([]);
});
