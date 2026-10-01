import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, login } from './helpers';

/** #100: create a calendar subscription link in the app, use it, revoke it. */
test('calendar subscription link: create, subscribe, revoke', async ({ browser, request }, testInfo) => {
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 320, height: 780 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await login(page);
  await page.goto('/settings/preferences');
  await page.getByRole('button', { name: 'Create subscription link' }).click();
  const urlField = page.getByRole('textbox', { name: 'Subscribe in your calendar app' });
  await expect(urlField).toHaveValue(/\/api\/calendar\.ics\?token=/);
  await expectNoHorizontalOverflow(page, '320px calendar subscription link');
  const feedUrl = new URL(await urlField.inputValue());

  const feed = await request.get(feedUrl.pathname + feedUrl.search);
  expect(feed.status()).toBe(200);
  expect(feed.headers()['content-type']).toMatch(/^text\/calendar/);
  expect(await feed.text()).toMatch(/^BEGIN:VCALENDAR/);

  await page.getByRole('button', { name: 'Revoke subscription links' }).click();
  await expect(page.getByText(/Subscription links revoked: 1/)).toBeVisible();
  expect((await request.get(feedUrl.pathname + feedUrl.search)).status()).toBe(401);
  await context.close();
});
