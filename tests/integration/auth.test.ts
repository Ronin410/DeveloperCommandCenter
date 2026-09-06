import { describe, expect, it } from 'vitest';
import { getAuthStore } from '@/lib/auth/store';
import { verifyPassword } from '@/lib/auth/password';

/**
 * Integration coverage for the authentication store: the seeded mock account,
 * session lifecycle and brute-force counting (spec §35).
 */
describe('auth store', () => {
  it('seeds the demo admin in mock mode', async () => {
    const user = await getAuthStore().findUserByEmail('admin@dcc.local');

    expect(user).not.toBeNull();
    expect(user?.role).toBe('ADMIN');
    await expect(verifyPassword('TestPassword!2026', user!.passwordHash)).resolves.toBe(true);
  });

  it('is case-insensitive on email', async () => {
    await expect(getAuthStore().findUserByEmail('ADMIN@DCC.LOCAL')).resolves.not.toBeNull();
  });

  it('returns null for unknown users', async () => {
    await expect(getAuthStore().findUserByEmail('nobody@dcc.local')).resolves.toBeNull();
  });

  it('creates, finds and deletes a session', async () => {
    const store = getAuthStore();
    const user = await store.findUserByEmail('admin@dcc.local');
    const expiresAt = new Date(Date.now() + 60_000);

    await store.createSession({ userId: user!.id, tokenHash: 'hash-1', csrfToken: 'csrf-1', expiresAt });

    const found = await store.findSessionByTokenHash('hash-1');
    expect(found?.user.email).toBe('admin@dcc.local');
    expect(found?.csrfToken).toBe('csrf-1');

    await store.deleteSessionByTokenHash('hash-1');
    await expect(store.findSessionByTokenHash('hash-1')).resolves.toBeNull();
  });

  it('counts recent failed attempts by email or IP', async () => {
    const store = getAuthStore();
    const since = new Date(Date.now() - 60_000);

    await store.recordLoginAttempt({ email: 'admin@dcc.local', ipAddress: '10.0.0.1', success: false });
    await store.recordLoginAttempt({ email: 'other@dcc.local', ipAddress: '10.0.0.1', success: false });
    await store.recordLoginAttempt({ email: 'admin@dcc.local', ipAddress: '10.0.0.2', success: true });

    await expect(store.countRecentFailures({ email: 'admin@dcc.local', ipAddress: '10.0.0.9', since })).resolves.toBe(1);
    await expect(store.countRecentFailures({ email: 'nobody@dcc.local', ipAddress: '10.0.0.1', since })).resolves.toBe(2);
  });
});
