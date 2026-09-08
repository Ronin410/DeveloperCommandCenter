import { expect, test, type Page } from '@playwright/test';

const EMAIL = process.env.MOCK_ADMIN_EMAIL ?? 'admin@dcc.local';
const PASSWORD = process.env.MOCK_ADMIN_PASSWORD ?? 'E2ePassword!2026';

async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/\/$/);
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test.describe('dashboard', () => {
  test('shows every overview panel', async ({ page }) => {
    for (const panel of ['Services', 'System', 'Projects', 'Alerts', 'Focus', 'Today']) {
      await expect(page.getByRole('heading', { name: panel, exact: true })).toBeVisible();
    }
  });

  test('navigates to every section', async ({ page }) => {
    const sections: [string, RegExp][] = [
      ['/infrastructure', /Infrastructure/],
      ['/projects', /Projects/],
      ['/deployments', /Deployments/],
      ['/git', /Repositories/],
      ['/alerts', /Alerts/],
      ['/focus', /Focus mode/],
      ['/calendar', /Calendar/],
      ['/settings', /Settings/],
    ];

    for (const [path, heading] of sections) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
    }
  });

  test('acknowledges an alert', async ({ page }) => {
    await page.goto('/alerts');
    const acknowledge = page.getByRole('button', { name: 'Acknowledge' }).first();

    if (await acknowledge.count()) {
      await acknowledge.click();
      await expect(page.getByText('ACKNOWLEDGED').first()).toBeVisible();
    }
  });

  test('runs a focus session', async ({ page }) => {
    await page.goto('/focus');
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();

    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByText('Ready')).toBeVisible();
  });

  test('renders the kiosk view without navigation', async ({ page }) => {
    await page.goto('/command-center');
    await expect(page.getByRole('heading', { name: /developer command center/i })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0);
  });

  test('adds, pauses and removes a monitored service from Infrastructure', async ({ page, baseURL }) => {
    await page.goto('/infrastructure');

    await page.getByRole('button', { name: 'Add service' }).click();
    const form = page.locator('form[aria-label="Add service to monitor"]');
    await form.getByPlaceholder('My API').fill('E2E Test Service');
    // Points at this same server's public health endpoint, so the immediate
    // check that runs on creation gets a real, deterministic 200.
    await form.getByPlaceholder('https://api.example.com/health').fill(`${baseURL}/api/health`);
    await form.getByRole('button', { name: 'Add service' }).click();

    const row = page.locator('tr', { hasText: 'E2E Test Service' });
    await expect(row).toBeVisible();
    await expect(row.getByText('ONLINE')).toBeVisible();

    await row.getByLabel('Pause').click();
    await expect(row.getByLabel('Resume')).toBeVisible();

    page.once('dialog', (dialog) => void dialog.accept());
    await row.getByLabel('Remove').click();
    await expect(row).toHaveCount(0);
  });
});
