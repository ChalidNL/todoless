import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { ADMIN, expectNoHorizontalOverflow, login } from './helpers';

/**
 * Invite & family baseline (tests/invite-flow-baseline.md, BT-P0-001…016) as
 * an executable two-user chain. BT-P0-001/002/013 for the admin are covered by
 * 01-onboarding-auth; this spec covers invites, the second user, family
 * visibility, privacy and the three form factors.
 */
test.describe.configure({ mode: 'serial' });

const VIEWPORTS = [
  { id: 'BT-P0-014 desktop', width: 1440, height: 900, mobile: false },
  { id: 'BT-P0-015 tablet', width: 768, height: 1024, mobile: true },
  { id: 'BT-P0-016 mobile', width: 360, height: 800, mobile: true },
] as const;
const MEMBER_PASSWORD = 'Member-Passw0rd!';
const SHARED_TASK = 'E2E family shared task';
const PRIVATE_TASK = 'E2E admin private task';

async function apiToken(request: APIRequestContext, email: string, password: string) {
  const res = await request.post('/api/collections/users/auth-with-password', { data: { identity: email, password } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as { token: string; record: { id: string; family_id: string } };
}

async function superuserHeaders(request: APIRequestContext) {
  const email = process.env.E2E_SU_EMAIL;
  const password = process.env.E2E_SU_PASSWORD;
  test.skip(!email || !password, 'requires scripts/e2e.sh (disposable superuser)');
  const res = await request.post('/api/collections/_superusers/auth-with-password', { data: { identity: email, password } });
  expect(res.ok()).toBeTruthy();
  return { Authorization: `Bearer ${(await res.json()).token}` };
}

/** BT-P0-003: the admin generates an invite through the Family screen. */
async function generateInvite(page: Page): Promise<{ code: string; url: string }> {
  await page.goto('/settings/members');
  const created = page.waitForResponse((r) => r.url().includes('/api/invites/create') && r.request().method() === 'POST');
  await page.getByRole('button', { name: /Generate member invite/i }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const { code } = await response.json();
  const dialog = page.getByRole('dialog', { name: 'Share member invite' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(code);
  const linkField = dialog.locator('input').filter({ hasNot: page.locator('[type=hidden]') }).last();
  // #258: the code travels in the fragment, never in the query string.
  await expect(linkField).toHaveValue(new RegExp(`/register#invite=${code}$`));
  await dialog.getByRole('button', { name: 'Close' }).first().click();
  return { code, url: `/register#invite=${code}` };
}

async function openInFreshContext(browser: Browser, baseURL: string | undefined, viewport: (typeof VIEWPORTS)[number]) {
  // BT-P0-004: separate browser context — no admin session is carried over.
  const context = await browser.newContext({
    baseURL,
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.mobile,
    hasTouch: viewport.mobile,
  });
  return { context, page: await context.newPage() };
}

async function registerWithInvite(page: Page, url: string, email: string, firstName: string) {
  await page.goto(url);
  // A valid invite link is validated on arrival and opens the account form.
  await page.locator('#register-first-name').fill(firstName);
  // The code is moved out of the address bar (and history) right away.
  expect(page.url()).not.toContain('invite=');
  await page.locator('#register-last-name').fill('Member');
  await page.locator('#register-email').fill(email);
  await page.locator('#register-password').fill(MEMBER_PASSWORD);
  await page.locator('#register-confirm-password').fill(MEMBER_PASSWORD);
  await page.getByRole('button', { name: 'Create Account' }).click();
}

test('BT-P0-003…009: invite, accept on desktop/tablet/mobile, family visibility and privacy', async ({ page, browser, request }, testInfo) => {
  const admin = await apiToken(request, ADMIN.email, ADMIN.password);
  const adminHeaders = { Authorization: `Bearer ${admin.token}` };
  // Shared and private data owned by the admin (BT-P0-008/009).
  for (const [title, isPrivate] of [[SHARED_TASK, false], [PRIVATE_TASK, true]] as const) {
    const res = await request.post('/api/collections/tasks/records', {
      headers: adminHeaders,
      data: { title, status: 'todo', is_private: isPrivate, user: admin.record.id },
    });
    expect(res.ok()).toBeTruthy();
  }

  await login(page);
  for (const viewport of VIEWPORTS) {
    const email = `e2e-${viewport.width}@example.com`;
    const { code, url: fragmentUrl } = await generateInvite(page);
    // Links sent before v1.0.0 used ?invite=; they keep working (mobile run).
    const url = viewport.mobile ? `/register?invite=${code}` : fragmentUrl;
    const { context, page: memberPage } = await openInFreshContext(browser, testInfo.project.use.baseURL, viewport);

    // BT-P0-005: registers once, joins the inviter's family.
    await registerWithInvite(memberPage, url, email, `Mia${viewport.width}`);
    await expect(memberPage.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    await expectNoHorizontalOverflow(memberPage, `${viewport.id} after registration`);
    const member = await apiToken(request, email, MEMBER_PASSWORD);
    expect(member.record.family_id).toBe(admin.record.family_id);

    // BT-P0-008/009: shared data visible, the admin's private task is not.
    await memberPage.getByRole('link', { name: 'Tasks' }).click();
    await expect(memberPage.getByText(SHARED_TASK)).toBeVisible();
    await expect(memberPage.getByText(PRIVATE_TASK)).toHaveCount(0);

    // BT-P0-007/013: member logs out (protected content gone) and back in.
    await memberPage.getByRole('link', { name: 'Settings' }).click();
    await memberPage.getByRole('button', { name: /Log out/i }).click();
    await expect(memberPage.locator('#login-email')).toBeVisible();
    await expect(memberPage.getByText(SHARED_TASK)).toHaveCount(0);
    await login(memberPage, email, MEMBER_PASSWORD);
    await context.close();

    // BT-P0-006: the admin sees the active member in the family view.
    await page.goto('/settings/members');
    const card = page.locator('article, li, div').filter({ hasText: `Mia${viewport.width} Member` }).last();
    await expect(card).toBeVisible();
    await expect(card).toContainText(/Active/i);
  }

  // Exactly one family: every member landed in the admin's family.
  const families = await request.get('/api/collections/families/records', { headers: adminHeaders });
  expect((await families.json()).totalItems).toBe(1);
});

test('BT-P0-010…012: invalid, expired and reused invites fail closed without creating users', async ({ page, browser, request }, testInfo) => {
  const su = await superuserHeaders(request);
  const countUsers = async () => (await (await request.get('/api/collections/users/records?perPage=1', { headers: su })).json()).totalItems as number;
  const before = await countUsers();

  // BT-P0-010 invalid
  const invalid = await openInFreshContext(browser, testInfo.project.use.baseURL, VIEWPORTS[2]);
  await invalid.page.goto('/register?invite=ZZZZZZZZZZZZ');
  await expect(invalid.page.getByRole('alert')).toBeVisible();
  await expect(invalid.page.locator('#register-first-name')).toHaveCount(0);
  await invalid.context.close();

  // BT-P0-011 expired: backdate a freshly generated invite.
  await login(page);
  const expired = await generateInvite(page);
  const list = await request.get(`/api/collections/invite_codes/records?filter=${encodeURIComponent(`code="${expired.code}"`)}`, { headers: su });
  const [record] = (await list.json()).items;
  await request.patch(`/api/collections/invite_codes/records/${record.id}`, { headers: su, data: { expires_at: '2020-01-01 00:00:00.000Z' } });
  const exp = await openInFreshContext(browser, testInfo.project.use.baseURL, VIEWPORTS[2]);
  await exp.page.goto(expired.url);
  await expect(exp.page.getByRole('alert')).toBeVisible();
  await expect(exp.page.locator('#register-first-name')).toHaveCount(0);
  await exp.context.close();
  const expiredRegister = await request.post('/api/register', {
    data: { email: 'e2e-expired@example.com', password: MEMBER_PASSWORD, passwordConfirm: MEMBER_PASSWORD, name: 'Expired', invite_code: expired.code },
  });
  expect(expiredRegister.status()).toBe(400);

  // BT-P0-012 reused: a used invite cannot register a second user.
  const reused = await generateInvite(page);
  const first = await openInFreshContext(browser, testInfo.project.use.baseURL, VIEWPORTS[2]);
  await registerWithInvite(first.page, reused.url, 'e2e-reuse-1@example.com', 'Reuse');
  await expect(first.page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await first.context.close();
  const second = await request.post('/api/register', {
    data: { email: 'e2e-reuse-2@example.com', password: MEMBER_PASSWORD, passwordConfirm: MEMBER_PASSWORD, name: 'Reuse Two', invite_code: reused.code },
  });
  expect(second.status()).toBe(400);

  // Only the one legitimate registration created a user.
  expect(await countUsers()).toBe(before + 1);
});
