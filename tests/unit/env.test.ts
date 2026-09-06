import { afterEach, describe, expect, it } from 'vitest';
import { getEnv, mockAdminPassword, resetEnvCache } from '@/lib/env';

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
  resetEnvCache();
});

describe('environment validation', () => {
  it('parses a valid environment', () => {
    expect(getEnv().MOCK_MODE).toBe(true);
    expect(getEnv().MONITORING_INTERVAL_SECONDS).toBe(30);
  });

  it('rejects a short AUTH_SECRET', () => {
    process.env.AUTH_SECRET = 'too-short';
    resetEnvCache();
    expect(() => getEnv()).toThrow(/AUTH_SECRET/);
  });

  it('requires DATABASE_URL when mock mode is off', () => {
    process.env.MOCK_MODE = 'false';
    delete process.env.DATABASE_URL;
    resetEnvCache();
    expect(() => getEnv()).toThrow(/DATABASE_URL/);
  });

  it('refuses the built-in demo password in production', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.MOCK_ADMIN_PASSWORD;
    resetEnvCache();
    expect(() => mockAdminPassword()).toThrow(/MOCK_ADMIN_PASSWORD/);
  });
});
