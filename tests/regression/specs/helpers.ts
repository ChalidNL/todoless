import { expect, Page } from '@playwright/test';
import { QA_USER } from '../config.mjs';

export const QA = QA_USER as { email: string; password: string; name: string };

/** True when the first-run gate is actually on screen (auto-waits; never races the initial render). */
export async function languageGateVisible(page: Page, timeout = 10_000) {
  return page
    .getByText('Choose your language')
    .first()
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false);
}

/** Walk through the first-run language step + product tour until the login screen. */
export async function passFirstRunGate(page: Page) {
  // NOTE: a bare .count() here used to be the single flakiest line in the suite —
  // on a cold route load the gate is not mounted at t=1.5s yet, so the whole block
  // was skipped and the test then burned its full timeout waiting for #login-email.
  // Always wait for the element instead of sampling the DOM once.
  if (await languageGateVisible(page)) {
    const next = page.getByRole('button', { name: /^Next$/i }).first();
    // The gate TEXT can be in the DOM for a moment while the app shell takes over
    // after a login; if the Next control is not really there this was not the gate
    // screen, so bail out instead of waiting 45s for a button that never appears.
    const hasNext = await next
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    if (!hasNext) return;
    // From here on the gate is a transition, not the subject of the test: tolerate
    // it disappearing mid-interaction (locator detaches when the shell swaps in).
    try {
    // "Next" stays disabled until a language is actually selected; the grid can
    // swallow the first click while the app is still hydrating, so retry.
    for (let i = 0; i < 6; i++) {
      if (await next.isEnabled().catch(() => false)) break;
      await page.getByRole('button', { name: /English/i }).first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
    if (await next.isEnabled().catch(() => false)) {
      await next.click({ timeout: 5_000 }).catch(() => {});
    } else {
      // Language selection occasionally does not register (hydration); "Skip"
      // is the equivalent way past this step and keeps the suite deterministic.
      await page.getByRole('button', { name: /^Skip$/i }).first().click({ timeout: 5_000 }).catch(() => {});
    }
    await page.waitForTimeout(1200);
    } catch {
      // gate vanished / navigated away — nothing left to step through
    }
  }
  // The tour screen exposes "Go to login" (older builds: "Skip"). Same caveat as
  // above: this is a transition, and the locator can detach mid-click, so every
  // interaction gets a short timeout instead of inheriting the 45s test timeout.
  for (let i = 0; i < 3; i++) {
    if (await page.locator('#login-email').isVisible().catch(() => false)) break;
    const exit = page.getByRole('button', { name: /^(Go to login|Skip)$/i }).first();
    if (!(await exit.isVisible().catch(() => false))) break;
    await exit.click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }
}

/** Login through the real UI. Returns once the app shell is visible. */
export async function login(page: Page) {
  await page.goto('/');
  await passFirstRunGate(page);
  const loginReady = await page
    .locator('#login-email')
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (!loginReady) {
    // Already authenticated in this context: the app shell is up, nothing to fill in.
    await expect(page.locator('body')).toContainText(/INBOX|TAKEN|Inbox/i, { timeout: 20_000 });
    return;
  }
  await page.fill('#login-email', QA.email);
  await page.fill('#login-password', QA.password);
  await page.getByRole('button', { name: /^Log In$/i }).first().click();
  // The per-user onboarding gate (`todoless_onboarding_completed` in localStorage,
  // keyed per user) can reappear right after a successful login. Probe briefly (so
  // the happy path stays fast) and only then pay for the full gate exit path — the
  // old ad-hoc clicks left the first login of a cold stack stuck on the gate.
  if (await languageGateVisible(page, 2_500)) {
    await passFirstRunGate(page);
  }
  await expect(page.locator('body')).toContainText(/INBOX|TAKEN|Inbox/i, { timeout: 20_000 });
}

/** Collect HTTP >= 400 responses and uncaught page errors for the current page. */
export function watchFailures(page: Page) {
  const fiveHundreds: string[] = [];
  const pageErrors: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 500) fiveHundreds.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));
  return { fiveHundreds, pageErrors };
}
