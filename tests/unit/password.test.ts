import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('password hashing', () => {
  it('verifies a correct password', async () => {
    const hash = await hashPassword('CorrectHorseBattery!');
    await expect(verifyPassword('CorrectHorseBattery!', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('CorrectHorseBattery!');
    await expect(verifyPassword('correcthorsebattery!', hash)).resolves.toBe(false);
  });

  it('produces a different salt for each hash', async () => {
    const [first, second] = await Promise.all([hashPassword('SamePassword123!'), hashPassword('SamePassword123!')]);
    expect(first).not.toEqual(second);
  });

  it('refuses short passwords', async () => {
    await expect(hashPassword('short')).rejects.toThrow(/at least 12/);
  });

  it('returns false for a malformed stored hash', async () => {
    await expect(verifyPassword('whatever', 'not-a-hash')).resolves.toBe(false);
    await expect(verifyPassword('whatever', 'bcrypt$1$2$3$4$5')).resolves.toBe(false);
  });
});
