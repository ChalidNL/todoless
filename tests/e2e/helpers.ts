import { expect, type Page } from '@playwright/test';

export const ADMIN = {
  firstName: 'Alex',
  lastName: 'Admin',
  email: 'e2e-admin@example.com',
  password: 'E2e-Passw0rd!',
  family: 'E2E Family',
};

export const MOBILE_WIDTHS = [320, 360, 375, 390, 412, 430] as const;

export const APP_ROUTES = [
  '/',
  '/tasks',
  '/calendar',
  '/groceries',
  '/settings',
  '/settings/profile',
  '/settings/members',
  '/settings/labels',
  '/settings/shops',
  '/settings/preferences',
  '/settings/notifications',
] as const;

/** Log in through the real login screen (skipping the info slides a fresh browser gets). */
export async function login(page: Page, email = ADMIN.email, password = ADMIN.password) {
  await page.goto('/');
  const goToLogin = page.getByRole('button', { name: 'Go to login' });
  const emailField = page.locator('#login-email');
  await expect(goToLogin.or(emailField).first()).toBeVisible();
  if (await goToLogin.isVisible()) await goToLogin.click();
  await emailField.fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
}

export interface OverflowReport {
  documentOverflow: number;
  /** Elements that scroll horizontally (overflow-x auto/scroll with wider content). */
  horizontalScrollers: string[];
  /** Visible elements whose box extends past the viewport's left/right edge and is not clipped. */
  offscreen: string[];
  /** Elements that currently scroll vertically (popovers excluded). */
  verticalScrollers: string[];
}

/**
 * Measures unintended horizontal overflow the way a user feels it: the
 * document, any nested horizontal scroll surface, and any element sticking out
 * of the viewport that is not clipped by an ancestor.
 */
export async function measureOverflow(page: Page): Promise<OverflowReport> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const describe = (el: Element) => {
      const cls = typeof (el as HTMLElement).className === 'string' ? (el as HTMLElement).className : '';
      const label = el.getAttribute('aria-label') || el.getAttribute('data-testid') || (el.textContent || '').trim();
      return `${el.tagName.toLowerCase()}.${cls.split(/\s+/).slice(0, 4).join('.')} "${label.slice(0, 40)}"`;
    };
    const report = {
      documentOverflow: document.documentElement.scrollWidth - vw,
      horizontalScrollers: [] as string[],
      offscreen: [] as string[],
      verticalScrollers: [] as string[],
    };
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      if (['auto', 'scroll'].includes(style.overflowX) && el.scrollWidth > el.clientWidth + 1) {
        report.horizontalScrollers.push(describe(el));
      }
      // Popovers ([data-popover]) may scroll their own bounded content.
      if (['auto', 'scroll'].includes(style.overflowY) && el.scrollHeight > el.clientHeight + 1 && !el.closest('[data-popover]')) {
        report.verticalScrollers.push(describe(el));
      }
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right <= vw + 0.5 && rect.left >= -0.5) continue;
      // Ignore content clipped by an ancestor that itself fits the viewport.
      let clipped = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (ps.overflowX === 'hidden' || ps.overflowX === 'clip') {
          const pr = p.getBoundingClientRect();
          if (pr.right <= vw + 0.5 && pr.left >= -0.5) { clipped = true; break; }
        }
      }
      if (!clipped) report.offscreen.push(`${describe(el)} [${Math.round(rect.left)}..${Math.round(rect.right)} of ${vw}]`);
    }
    report.offscreen = report.offscreen.slice(0, 10);
    return report;
  });
}

export async function expectNoHorizontalOverflow(page: Page, context: string) {
  const report = await measureOverflow(page);
  expect(report.documentOverflow, `${context}: document is wider than the viewport`).toBeLessThanOrEqual(0);
  expect(report.horizontalScrollers, `${context}: unexpected horizontal scroll surface`).toEqual([]);
  expect(report.offscreen, `${context}: elements extend past the viewport`).toEqual([]);
  return report;
}
