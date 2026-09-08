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

    await row.getByLabel('Edit').click();
    const editForm = page.locator('form[aria-label="Edit service"]');
    await editForm.locator('input').first().fill('E2E Test Service Renamed');
    await editForm.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('tr', { hasText: 'E2E Test Service Renamed' })).toBeVisible();

    const renamedRow = page.locator('tr', { hasText: 'E2E Test Service Renamed' });
    page.once('dialog', (dialog) => void dialog.accept());
    await renamedRow.getByLabel('Remove').click();
    await expect(renamedRow).toHaveCount(0);
  });

  test('adds, edits and removes a project from Projects', async ({ page }) => {
    await page.goto('/projects');

    await page.getByRole('button', { name: 'Add project' }).click();
    const form = page.locator('form[aria-label="Add project"]');
    await form.getByPlaceholder('My Project').fill('E2E Test Project');
    await form.getByRole('button', { name: 'Add project' }).click();

    const card = page.locator('section', { hasText: 'E2E Test Project' });
    await expect(card).toBeVisible();

    await card.getByLabel('Edit E2E Test Project').click();
    const editForm = page.locator('form[aria-label="Edit project"]');
    await editForm.locator('input').first().fill('E2E Test Project Renamed');
    await editForm.getByRole('button', { name: 'Save changes' }).click();

    const renamedCard = page.locator('section', { hasText: 'E2E Test Project Renamed' });
    await expect(renamedCard).toBeVisible();

    page.once('dialog', (dialog) => void dialog.accept());
    await renamedCard.getByLabel('Remove E2E Test Project Renamed').click();
    await expect(renamedCard).toHaveCount(0);
  });

  test('views logs, stops and restarts a Docker container', async ({ page }) => {
    await page.goto('/infrastructure');

    const dockerCard = page.locator('section', { has: page.getByRole('heading', { name: 'Docker' }) });
    const row = dockerCard.locator('tbody tr').first();

    await row.getByLabel('Logs').click();
    await expect(page.getByText(/^Logs — /)).toBeVisible();
    await page.getByLabel('Close').click();

    page.once('dialog', (dialog) => void dialog.accept());
    await row.getByLabel('Stop').click();
    await expect(row.getByText('exited')).toBeVisible();

    page.once('dialog', (dialog) => void dialog.accept());
    await row.getByLabel('Restart').click();
    await expect(row.getByText('running')).toBeVisible();
  });

  test('expands the database deep-metrics panel', async ({ page }) => {
    await page.goto('/infrastructure');

    await page.getByRole('button', { name: 'Details' }).click();
    await expect(page.getByRole('heading', { name: 'Largest tables' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Slowest queries' })).toBeVisible();
  });
});
