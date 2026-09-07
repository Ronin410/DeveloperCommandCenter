import { expect, test } from '@playwright/test';

const EMAIL = process.env.MOCK_ADMIN_EMAIL ?? 'admin@dcc.local';
const PASSWORD = process.env.MOCK_ADMIN_PASSWORD ?? 'E2ePassword!2026';

test.describe('authentication', () => {
  test('redirects an anonymous visitor to the login screen', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();
  });

  test('rejects invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', EMAIL);
    await page.fill('#password', 'definitely-wrong');
    await page.click('button[type=submit]');

    await expect(page.getByTestId('login-error')).toContainText(/invalid/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test('signs in, lands on the dashboard and signs out', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASSWORD);
    await page.click('button[type=submit]');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /developer command center/i })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('protects the API without a session', async ({ request }) => {
    const response = await request.get('/api/overview');
    expect(response.status()).toBe(401);
  });

  test('serves a public health endpoint', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBe(true);
    expect(await response.json()).toMatchObject({ status: 'ok' });
  });
});
