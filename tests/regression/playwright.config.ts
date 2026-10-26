import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * TodoLess regression suite.
 *
 * Target is env-driven so the SAME suite runs against dev / red / prod:
 *   BASE_URL=http://192.168.2.100:7070 npx playwright test
 *
 * Local dev stack (frontend `vite` + local PocketBase) is the default for CI-less runs.
 */
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173';
// Pre-installed browser build (avoids a 200MB download in restricted environments).
// Only honoured when the binary actually exists — a stale hard-coded path used to
// make every test fail at launch, which looks like a product defect and is not one.
const CHROME_DEFAULT = '/opt/data/.playwright/chromium-1223/chrome-linux64/chrome';
const CHROME_CANDIDATE = process.env.PW_CHROME_PATH || CHROME_DEFAULT;
const CHROME = existsSync(CHROME_CANDIDATE) ? CHROME_CANDIDATE : undefined;

export default defineConfig({
  testDir: './specs',
  timeout: 45_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: process.env.PW_JSON_OUT || 'artifacts/results.json' }],
    ['html', { outputFolder: 'artifacts/html', open: 'never' }],
  ],
  use: {
    baseURL: BASE_URL,
    headless: true,
    launchOptions: CHROME ? { executablePath: CHROME } : {},
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
    viewport: { width: 420, height: 900 },
  },
  projects: [{ name: 'chromium-mobile', use: { ...devices['Desktop Chrome'] } }],
});
