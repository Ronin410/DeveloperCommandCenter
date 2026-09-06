import { beforeEach } from 'vitest';

/**
 * Deterministic environment for every suite (spec §35).
 * NODE_ENV is typed read-only by Next's ambient types, hence the cast.
 */
const env = process.env as Record<string, string | undefined>;
env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test-secret-value-that-is-long-enough-for-zod';
process.env.APP_URL = 'http://localhost:3000';
process.env.MOCK_MODE = 'true';
process.env.MOCK_ADMIN_EMAIL = 'admin@dcc.local';
process.env.MOCK_ADMIN_PASSWORD = 'TestPassword!2026';
process.env.LOGIN_MAX_ATTEMPTS = '5';
process.env.LOGIN_LOCKOUT_MINUTES = '15';
delete process.env.DATABASE_URL;

beforeEach(async () => {
  const [{ resetEnvCache }, { resetContainer }, { resetAuthStore }, { resetMockState }] = await Promise.all([
    import('@/lib/env'),
    import('@/services/container'),
    import('@/lib/auth/store'),
    import('@/services/mock/adapters'),
  ]);

  resetEnvCache();
  resetContainer();
  resetAuthStore();
  resetMockState();
});
