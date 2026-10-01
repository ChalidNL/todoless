import { defineConfig, devices } from '@playwright/test';

/**
 * Mobile-first E2E suite (tests/e2e/*.spec.ts). Runs against a production build
 * served by `vite preview` with /api proxied to a throwaway PocketBase —
 * use `npm run test:e2e` (scripts/e2e.sh) which boots both.
 *
 * Specs share one fresh backend and run in file order (01-, 02-, ...): the
 * first spec performs the real first-run onboarding that later specs log into.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : 'list',
  outputDir: 'test-results',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Pixel 7'],
    // Pixel 7 is 412px wide; specs that sweep widths set their own viewport.
    locale: 'en-US',
    timezoneId: 'Europe/Amsterdam',
  },
  projects: [{ name: 'mobile-chromium' }],
});
