import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { ADMIN, APP_ROUTES, MOBILE_WIDTHS, expectNoHorizontalOverflow, login, measureOverflow } from './helpers';

/**
 * Mobile regression matrix: every primary screen at every supported phone
 * width (plus tablet/desktop as regression protection) must have
 *  - no horizontal overflow (document, nested scroll surfaces, off-screen boxes)
 *  - no scrolling document (the app shell is fixed; only the content pane scrolls)
 *  - at most one vertical scroll surface
 * with realistic, deliberately long content seeded first.
 */
const LONG_TITLE = 'Call the plumber about the leaking kitchen tap before grandma visits this weekend';
const UNBREAKABLE = 'Supercalifragilisticexpialidocious-unbreakable-string-without-any-spaces-at-all';

async function seed(request: APIRequestContext) {
  const authRes = await request.post('/api/collections/users/auth-with-password', {
    data: { identity: ADMIN.email, password: ADMIN.password },
  });
  expect(authRes.ok()).toBeTruthy();
  const { token, record } = await authRes.json();
  const headers = { Authorization: `Bearer ${token}` };
  const create = async (collection: string, data: Record<string, unknown>) => {
    const res = await request.post(`/api/collections/${collection}/records`, { headers, data });
    expect(res.ok(), `${collection}: ${await res.text()}`).toBeTruthy();
    return res.json();
  };
  const label = await create('labels', {
    name: 'A very long label name for school activities', color: '#8b5cf6', visibility: 'family',
    owner: record.id, user: record.id, family: record.family_id,
  });
  const shop = await create('shops', { name: 'Neighbourhood organic farmers market', color: '#ec4899', user: record.id });
  const now = new Date();
  const at = (h: number) => { const d = new Date(now); d.setHours(h, 0, 0, 0); return d.toISOString(); };
  await create('tasks', { title: LONG_TITLE, status: 'backlog', user: record.id, label: [], labels: [] });
  await create('tasks', { title: UNBREAKABLE, status: 'backlog', user: record.id, label: [], labels: [] });
  await create('tasks', {
    title: `${LONG_TITLE} (sprint)`, status: 'todo', user: record.id, label: [label.id], labels: [label.id],
    due_date: at(10), start_time: at(10), end_time: at(11), show_in_calendar: true, priority: 'high',
  });
  await create('tasks', { title: 'Dentist', status: 'todo', user: record.id, due_date: at(15), start_time: at(15), end_time: at(16), show_in_calendar: true });
  await create('items', { title: `Organic semi-skimmed milk 2L ${UNBREAKABLE}`, quantity: 2, user: record.id, shop_id: shop.id });
  await create('items', { title: 'Bread', quantity: 1, user: record.id });
}

/** Screenshots for visual review: attached to the report and kept under test-results/. */
async function snap(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(name);
  await page.screenshot({ path });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

async function expectAppFitsViewport(page: Page, context: string) {
  const report = await expectNoHorizontalOverflow(page, context);
  // The shell is fixed to the viewport: the document itself never scrolls.
  const doc = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight }));
  expect(doc.sh, `${context}: document scrolls vertically`).toBeLessThanOrEqual(doc.ch);
  expect(report.verticalScrollers.length, `${context}: nested vertical scroll surfaces ${JSON.stringify(report.verticalScrollers)}`).toBeLessThanOrEqual(1);
}

test.beforeAll(async ({ request }) => {
  await seed(request);
});

for (const width of [...MOBILE_WIDTHS, 768, 1280]) {
  test(`every screen fits a ${width}px viewport`, async ({ browser }, testInfo) => {
    const desktop = width >= 1024;
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      viewport: { width, height: width >= 768 ? 1024 : 780 },
      isMobile: !desktop,
      hasTouch: !desktop,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await login(page);
    for (const route of APP_ROUTES) {
      await page.goto(route);
      await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
      // (No networkidle: the app keeps a realtime SSE connection open.)
      await page.waitForTimeout(300);
      await expectAppFitsViewport(page, `${width}px ${route}`);
      if (width === 320 || width === 390) {
        await snap(page, testInfo, `${width}${route.replace(/\//g, '_')}.png`);
      }
    }
    await context.close();
  });
}

for (const width of [320, 390]) {
  test(`interactive states stay inside a ${width}px viewport`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      viewport: { width, height: 780 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await login(page);

    // Reported bug: typing in the header search and tapping + scrolled the
    // whole screen sideways (the + button sat outside the viewport).
    for (const route of ['/', '/tasks', '/groceries', '/calendar', '/settings/labels', '/settings/shops', '/settings/members']) {
      await page.goto(route);
      const add = page.getByRole('button', { name: 'Add', exact: true });
      await expect(add).toBeVisible();
      const box = await add.boundingBox();
      expect(box!.x + box!.width, `${route}: + button outside the viewport`).toBeLessThanOrEqual(width);
      const search = page.locator('.safe-top input[type="text"]').first();
      if (await search.count()) await search.fill(UNBREAKABLE);
      await expectAppFitsViewport(page, `${width}px ${route} search filled`);
      await add.click();
      await expectAppFitsViewport(page, `${width}px ${route} after +`);
      const main = await page.evaluate(() => document.querySelector('main')?.scrollLeft ?? 0);
      expect(main, `${route}: content pane scrolled sideways`).toBe(0);
    }

    // Filter dropdown
    await page.goto('/tasks');
    await page.getByRole('button', { name: 'Filters' }).click();
    await expectAppFitsViewport(page, `${width}px filter dropdown`);

    // Expanded task card + editors
    await page.goto('/');
    await page.getByRole('button', { name: 'Open Editor' }).first().click();
    await expectAppFitsViewport(page, `${width}px expanded inbox card`);
    await page.getByRole('button', { name: 'Edit labels' }).first().click();
    await expectAppFitsViewport(page, `${width}px label editor`);
    await snap(page, testInfo, `${width}-inbox-editor.png`);

    // Calendar: every view, and an expanded event in the week grid
    await page.goto('/calendar');
    for (const view of ['schedule', 'day', '3days', 'week', 'workweek', 'month']) {
      await page.getByRole('combobox', { name: 'Calendar view' }).selectOption(view);
      await expectAppFitsViewport(page, `${width}px calendar ${view}`);
    }
    await page.getByRole('combobox', { name: 'Calendar view' }).selectOption('week');
    const event = page.locator('[data-testid^="calendar-timed-task-"]').first();
    await event.getByRole('button', { name: 'Open Editor' }).click();
    await expectAppFitsViewport(page, `${width}px calendar expanded event`);
    await snap(page, testInfo, `${width}-calendar-week-expanded.png`);

    // Onboarding-style full screens reachable while signed in are covered by
    // 01-onboarding-auth; here: the members invite flow dialog.
    await page.goto('/settings/members');
    const report = await measureOverflow(page);
    expect(report.documentOverflow).toBeLessThanOrEqual(0);

    await context.close();
  });
}
