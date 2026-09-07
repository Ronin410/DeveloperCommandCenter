import { afterEach, describe, expect, it } from 'vitest';
import { bootstrapAdmin, bootstrapCatalogue } from '@/database/bootstrap';
import { getEnv, resetEnvCache } from '@/lib/env';

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
  resetEnvCache();
});

/**
 * The bootstrap runs unattended on every server start, so its safety rails
 * matter more than its happy path: it must never invent an account in mock
 * mode, never accept a weak password, and never touch a database that is not
 * configured. The creation path itself is covered by the migration-and-boot
 * check documented in DEPLOYMENT.md.
 */
describe('first-run bootstrap', () => {
  it('does nothing in mock mode, even with credentials present', async () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com';
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'a-long-enough-password';
    resetEnvCache();

    await expect(bootstrapAdmin()).resolves.toBe('skipped');
    await expect(bootstrapCatalogue()).resolves.toBe('skipped');
  });

  it('rejects a bootstrap password shorter than 12 characters', () => {
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'short';
    resetEnvCache();

    expect(() => getEnv()).toThrow(/BOOTSTRAP_ADMIN_PASSWORD/);
  });

  it('rejects an invalid bootstrap email', () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'not-an-email';
    resetEnvCache();

    expect(() => getEnv()).toThrow(/BOOTSTRAP_ADMIN_EMAIL/);
  });

  it('has no default credentials', () => {
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
    resetEnvCache();

    expect(getEnv().BOOTSTRAP_ADMIN_EMAIL).toBeUndefined();
    expect(getEnv().BOOTSTRAP_ADMIN_PASSWORD).toBeUndefined();
  });
});
