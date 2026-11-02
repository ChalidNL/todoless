import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe.configure({ mode: 'serial' });

/**
 * Regression for henry/t_3885e817: after a real login, `/` intermittently
 * stayed stuck on the "Loading..." spinner for up to 45s before INBOX
 * content appeared (two local runs of the SAME commit 20 minutes apart:
 * 8.1s pass vs 45.3s timeout).
 *
 * Root cause: `PocketBaseClient.getBootstrap()` (src/lib/pocketbase-client.ts)
 * called `fetch('/api/bootstrap', ...)` with NO timeout/AbortSignal. A single
 * stalled connection (dropped socket, upstream hiccup) left that promise
 * pending indefinitely — `AppContext.refreshAll()` never leaves
 * `dataLoadState: 'loading'`, so the UI shows the loading spinner
 * indefinitely instead of failing fast into the already-existing
 * per-collection fallback path in `refreshAll()`'s catch block.
 *
 * This test forces a stalled bootstrap connection deterministically (a
 * `page.route` handler that never resolves/aborts) and asserts the app
 * recovers — reaches real content OR a visible retryable error state —
 * well inside the fix's 10s timeout, instead of hanging indefinitely.
 */
test('route health /: a stalled /api/bootstrap recovers quickly instead of hanging', async ({ page }) => {
  // Real login first — the admin account was created by 01-onboarding-auth.
  await login(page);

  const consoleErrors: string[] = [];
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  // Stall EVERY /api/bootstrap call indefinitely (never fulfill/abort the
  // route) — simulates a dropped connection on session restore. AppContext
  // can legitimately fire refreshAll() twice in quick succession (mount +
  // the authStore.onChange that authRefresh() triggers once it resolves),
  // so every attempt must be stalled, not just the first.
  await page.route('**/api/bootstrap', async () => {
    // Never call route.fulfill/continue/abort — the request stays pending
    // forever from the page's point of view, exactly like a stalled TCP
    // connection. Playwright cleans this handler up at test end.
    await new Promise(() => {});
  });

  await page.reload();

  // The fix bounds the bootstrap fetch to 10s. Give it a margin and assert
  // the app has moved OFF the stuck-loading state within ~13s — either by
  // showing the real app (fallback succeeded) or a visible, actionable error
  // state (retry button) — never an indefinite "Loading..." spinner.
  const deadline = Date.now() + 13_000;
  let recovered = false;
  while (Date.now() < deadline) {
    const stuckOnLoadingOnly = await page.evaluate(() => {
      const text = (document.body.innerText || '').trim();
      const hasRetry = !!document.querySelector('[role="alert"]') ||
        Array.from(document.querySelectorAll('button')).some((b) => /retry/i.test(b.textContent || ''));
      const hasNav = !!document.querySelector('nav[aria-label="Primary"]');
      return { text, hasRetry, hasNav };
    });
    if (stuckOnLoadingOnly.hasRetry || stuckOnLoadingOnly.hasNav) {
      recovered = true;
      break;
    }
    await page.waitForTimeout(250);
  }

  expect(recovered, 'app stayed stuck (no retry UI, no app shell) past the 10s bootstrap timeout + margin').toBe(true);
  expect(consoleErrors, 'uncaught page errors while recovering from a stalled bootstrap').toEqual([]);
});
