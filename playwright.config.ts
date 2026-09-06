import { defineConfig, devices } from '@playwright/test';

/**
 * E2E configuration (spec §35). The suite runs against a production build in
 * mock mode, so it needs no database and no external infrastructure.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Allows running against a browser that is already on the machine
    // (containers, CI images) instead of a Playwright-managed download.
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } }
      : {}),
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run build && npm run start -- --port 3100',
        url: 'http://localhost:3100/api/health',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          MOCK_MODE: 'true',
          MOCK_ADMIN_EMAIL: 'admin@dcc.local',
          MOCK_ADMIN_PASSWORD: 'E2ePassword!2026',
          AUTH_SECRET: 'e2e-secret-value-that-is-long-enough-for-zod-validation',
          APP_URL: 'http://localhost:3100',
          // The suite signs in on nearly every test from one IP; the default
          // production limit would (correctly) throttle it.
          LOGIN_RATE_LIMIT_PER_MINUTE: '200',
          LOGIN_MAX_ATTEMPTS: '50',
        },
      },
});
