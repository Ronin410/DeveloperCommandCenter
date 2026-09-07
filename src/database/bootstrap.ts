import 'server-only';
import { getPrisma, isDatabaseConfigured } from '@/database/client';
import { hashPassword } from '@/lib/auth/password';
import { getEnv, isMockMode } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * First-run administrator bootstrap.
 *
 * A freshly migrated database has no users, which means nobody can sign in and
 * there is no self-service registration (by design — this is a personal
 * console, not a SaaS). Rather than requiring a manual seed step on every
 * platform, the account is created at server start from
 * BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD.
 *
 * Safety properties:
 *  - No default credentials. Without both variables, nothing happens.
 *  - Only ever creates; an existing account is never modified, so rotating the
 *    variable does not silently reset a password.
 *  - Only runs when a real database is configured (never in mock mode).
 */
export async function bootstrapAdmin(): Promise<'created' | 'skipped' | 'exists'> {
  if (isMockMode() || !isDatabaseConfigured()) return 'skipped';

  const env = getEnv();
  const email = env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase();
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password) return 'skipped';

  const prisma = getPrisma();

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return 'exists';

  await prisma.user.create({
    data: {
      email,
      name: env.BOOTSTRAP_ADMIN_NAME,
      role: 'ADMIN',
      passwordHash: await hashPassword(password),
    },
  });

  logger.info('Bootstrap administrator created', { email });
  return 'created';
}

/**
 * First-run catalogue.
 *
 * A freshly migrated database has no services, so the dashboard would greet a
 * new deployment with empty panels. Registering the DCC's own API gives the
 * monitoring engine a real target from the first minute and satisfies the
 * self-observability requirement (spec §32).
 *
 * Only runs when the `Service` table is empty, so it never fights with a
 * catalogue you curate yourself.
 */
export async function bootstrapCatalogue(): Promise<'created' | 'skipped'> {
  if (isMockMode() || !isDatabaseConfigured()) return 'skipped';

  const prisma = getPrisma();
  if ((await prisma.service.count()) > 0) return 'skipped';

  const env = getEnv();

  const project = await prisma.project.upsert({
    where: { slug: 'developer-command-center' },
    update: {},
    create: {
      slug: 'developer-command-center',
      name: 'Developer Command Center',
      description: 'This platform, monitoring itself.',
      environment: env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT',
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0',
    },
  });

  await prisma.service.create({
    data: {
      slug: 'dcc-api',
      name: 'DCC API',
      description: 'The Command Center API',
      kind: 'API',
      environment: project.environment,
      healthUrl: `${env.APP_URL}/api/health`,
      isMonitored: true,
      projectId: project.id,
    },
  });

  logger.info('Bootstrap catalogue created', { project: project.slug });
  return 'created';
}
