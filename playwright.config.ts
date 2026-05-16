import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:7072',
    trace: 'on-first-retry',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        executablePath: '/opt/data/profiles/henry/home/.agent-browser/browsers/chrome-148.0.7778.56/chrome',
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        executablePath: '/opt/data/profiles/henry/home/.agent-browser/browsers/chrome-148.0.7778.56/chrome',
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 7072 --host 0.0.0.0',
    url: 'http://localhost:7072',
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      VITE_POCKETBASE_URL: 'http://localhost:8092',
    },
  },
  // Skip typechecking during test runs (node_modules have zod issues)
  expect: {
    timeout: 10000,
  },
  timeout: 30000,
});
