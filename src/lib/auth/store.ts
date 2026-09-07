import 'server-only';
import type { Role } from '@/types/domain';
import { getEnv, isMockMode, mockAdminPassword } from '@/lib/env';
import { getPrisma, isDatabaseConfigured } from '@/database/client';
import { hashPassword } from '@/lib/auth/password';
import { logger } from '@/lib/logger';

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
  isActive: boolean;
}

export interface StoredSession {
  id: string;
  userId: string;
  csrfToken: string;
  expiresAt: Date;
}

/**
 * Persistence port for authentication.
 *
 * Two implementations exist so the dashboard is fully usable before Postgres
 * is wired up (spec §33). Swapping mock → real is a container decision, not a
 * code change in the callers.
 */
export interface AuthStore {
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(id: string): Promise<StoredUser | null>;
  createSession(input: {
    userId: string;
    tokenHash: string;
    csrfToken: string;
    expiresAt: Date;
    userAgent?: string | null;
    ipAddress?: string | null;
  }): Promise<StoredSession>;
  findSessionByTokenHash(tokenHash: string): Promise<(StoredSession & { user: StoredUser }) | null>;
  touchSession(id: string): Promise<void>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  deleteSessionsForUser(userId: string): Promise<void>;
  recordLoginAttempt(input: { email: string; ipAddress: string; success: boolean }): Promise<void>;
  countRecentFailures(input: { email: string; ipAddress: string; since: Date }): Promise<number>;
}

// ---------------------------------------------------------------------------
// In-memory store (mock mode)
// ---------------------------------------------------------------------------

interface MemoryState {
  users: Map<string, StoredUser>;
  sessions: Map<string, StoredSession & { tokenHash: string }>;
  attempts: { email: string; ipAddress: string; success: boolean; createdAt: Date }[];
  /** In-flight or completed seeding. Kept as a promise so concurrent requests
   *  share one hash computation, and a failed seed can be retried. */
  seeding: Promise<void> | null;
}

const globalForMemory = globalThis as unknown as { dccAuthMemory?: MemoryState };

function memoryState(): MemoryState {
  globalForMemory.dccAuthMemory ??= { users: new Map(), sessions: new Map(), attempts: [], seeding: null };
  return globalForMemory.dccAuthMemory;
}

async function ensureSeeded(state: MemoryState): Promise<void> {
  state.seeding ??= (async () => {
    const email = getEnv().MOCK_ADMIN_EMAIL.toLowerCase();
    const user: StoredUser = {
      id: 'usr_mock_admin',
      email,
      name: 'Command Center Admin',
      role: 'ADMIN',
      // Throws in production unless MOCK_ADMIN_PASSWORD is set explicitly.
      passwordHash: await hashPassword(mockAdminPassword()),
      isActive: true,
    };
    state.users.set(email, user);
    logger.warn('Mock mode enabled: using in-memory demo account', { email });
  })().catch((error: unknown) => {
    // Never cache a failed seed: the next request must retry rather than see
    // an empty user store and report "invalid credentials".
    state.seeding = null;
    throw error;
  });

  await state.seeding;
}

class MemoryAuthStore implements AuthStore {
  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const state = memoryState();
    await ensureSeeded(state);
    return state.users.get(email.toLowerCase()) ?? null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    const state = memoryState();
    await ensureSeeded(state);
    return [...state.users.values()].find((user) => user.id === id) ?? null;
  }

  async createSession(input: {
    userId: string;
    tokenHash: string;
    csrfToken: string;
    expiresAt: Date;
  }): Promise<StoredSession> {
    const session = {
      id: `ses_${input.tokenHash.slice(0, 12)}`,
      userId: input.userId,
      csrfToken: input.csrfToken,
      expiresAt: input.expiresAt,
      tokenHash: input.tokenHash,
    };
    memoryState().sessions.set(input.tokenHash, session);
    return session;
  }

  async findSessionByTokenHash(tokenHash: string): Promise<(StoredSession & { user: StoredUser }) | null> {
    const state = memoryState();
    await ensureSeeded(state);
    const session = state.sessions.get(tokenHash);
    if (!session) return null;

    const user = await this.findUserById(session.userId);
    if (!user) return null;
    return { ...session, user };
  }

  async touchSession(): Promise<void> {
    // No-op: last-used tracking is only interesting with a real database.
  }

  async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    memoryState().sessions.delete(tokenHash);
  }

  async deleteSessionsForUser(userId: string): Promise<void> {
    const state = memoryState();
    for (const [hash, session] of state.sessions) {
      if (session.userId === userId) state.sessions.delete(hash);
    }
  }

  async recordLoginAttempt(input: { email: string; ipAddress: string; success: boolean }): Promise<void> {
    const state = memoryState();
    state.attempts.push({ ...input, email: input.email.toLowerCase(), createdAt: new Date() });
    if (state.attempts.length > 500) state.attempts.splice(0, state.attempts.length - 500);
  }

  async countRecentFailures(input: { email: string; ipAddress: string; since: Date }): Promise<number> {
    return memoryState().attempts.filter(
      (attempt) =>
        !attempt.success &&
        attempt.createdAt >= input.since &&
        (attempt.email === input.email.toLowerCase() || attempt.ipAddress === input.ipAddress),
    ).length;
  }
}

// ---------------------------------------------------------------------------
// Prisma store
// ---------------------------------------------------------------------------

class PrismaAuthStore implements AuthStore {
  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const user = await getPrisma().user.findUnique({ where: { email: email.toLowerCase() } });
    return user ? this.toStoredUser(user) : null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    const user = await getPrisma().user.findUnique({ where: { id } });
    return user ? this.toStoredUser(user) : null;
  }

  private toStoredUser(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    passwordHash: string;
    isActive: boolean;
  }): StoredUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      passwordHash: user.passwordHash,
      isActive: user.isActive,
    };
  }

  async createSession(input: {
    userId: string;
    tokenHash: string;
    csrfToken: string;
    expiresAt: Date;
    userAgent?: string | null;
    ipAddress?: string | null;
  }): Promise<StoredSession> {
    const session = await getPrisma().session.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        csrfToken: input.csrfToken,
        expiresAt: input.expiresAt,
        userAgent: input.userAgent ?? null,
        ipAddress: input.ipAddress ?? null,
      },
    });
    return { id: session.id, userId: session.userId, csrfToken: session.csrfToken, expiresAt: session.expiresAt };
  }

  async findSessionByTokenHash(tokenHash: string): Promise<(StoredSession & { user: StoredUser }) | null> {
    const session = await getPrisma().session.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!session) return null;
    return {
      id: session.id,
      userId: session.userId,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
      user: this.toStoredUser(session.user),
    };
  }

  async touchSession(id: string): Promise<void> {
    await getPrisma().session.update({ where: { id }, data: { lastUsedAt: new Date() } });
  }

  async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    await getPrisma().session.deleteMany({ where: { tokenHash } });
  }

  async deleteSessionsForUser(userId: string): Promise<void> {
    await getPrisma().session.deleteMany({ where: { userId } });
  }

  async recordLoginAttempt(input: { email: string; ipAddress: string; success: boolean }): Promise<void> {
    await getPrisma().loginAttempt.create({
      data: { email: input.email.toLowerCase(), ipAddress: input.ipAddress, success: input.success },
    });
  }

  async countRecentFailures(input: { email: string; ipAddress: string; since: Date }): Promise<number> {
    return getPrisma().loginAttempt.count({
      where: {
        success: false,
        createdAt: { gte: input.since },
        OR: [{ email: input.email.toLowerCase() }, { ipAddress: input.ipAddress }],
      },
    });
  }
}

let store: AuthStore | null = null;

export function getAuthStore(): AuthStore {
  if (!store) {
    store = isMockMode() || !isDatabaseConfigured() ? new MemoryAuthStore() : new PrismaAuthStore();
  }
  return store;
}

/** Test helper. */
export function resetAuthStore(): void {
  store = null;
  globalForMemory.dccAuthMemory = undefined;
}
