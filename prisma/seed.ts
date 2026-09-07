/**
 * Database seed (spec §27).
 *
 * Creates the bootstrap admin plus a small, realistic catalogue so a fresh
 * install with MOCK_MODE=false is not an empty dashboard. Idempotent: every
 * write is an upsert keyed by a natural unique field.
 *
 * Run with: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  const params = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize('NFKC'), salt, 64, params);
  return ['scrypt', params.N, params.r, params.p, salt.toString('base64'), derived.toString('base64')].join('$');
}

async function main(): Promise<void> {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@dcc.local').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password) {
    throw new Error('SEED_ADMIN_PASSWORD is required. Set it in your environment (never commit it).');
  }
  if (password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters long.');
  }

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: 'Command Center Admin', role: 'ADMIN', passwordHash: await hashPassword(password) },
  });
  console.log(`✓ admin user: ${admin.email}`);

  const project = await prisma.project.upsert({
    where: { slug: 'developer-command-center' },
    update: {},
    create: {
      slug: 'developer-command-center',
      name: 'Developer Command Center',
      description: 'This platform, monitoring itself.',
      environment: 'PRODUCTION',
      version: '0.1.0',
      ownerId: admin.id,
    },
  });

  const services: { slug: string; name: string; kind: 'API' | 'DATABASE' | 'CACHE'; healthUrl: string | null }[] = [
    { slug: 'dcc-api', name: 'DCC API', kind: 'API', healthUrl: `${process.env.APP_URL ?? 'http://localhost:3000'}/api/health` },
    { slug: 'postgres', name: 'PostgreSQL', kind: 'DATABASE', healthUrl: null },
    { slug: 'redis', name: 'Redis', kind: 'CACHE', healthUrl: null },
  ];

  for (const service of services) {
    await prisma.service.upsert({
      where: { slug: service.slug },
      update: {},
      create: {
        slug: service.slug,
        name: service.name,
        kind: service.kind,
        environment: 'PRODUCTION',
        healthUrl: service.healthUrl,
        isMonitored: Boolean(service.healthUrl),
        projectId: project.id,
      },
    });
  }
  console.log(`✓ ${services.length} services`);

  const rules = [
    { name: 'Service offline', type: 'API_DOWN', severity: 'CRITICAL', operator: 'EQ', threshold: 0, metric: null },
    { name: 'High latency', type: 'HIGH_LATENCY', severity: 'WARNING', operator: 'GT', threshold: 2000, metric: 'LATENCY' },
    { name: 'High CPU', type: 'HIGH_CPU', severity: 'WARNING', operator: 'GT', threshold: 85, metric: 'CPU' },
    { name: 'High memory', type: 'HIGH_MEMORY', severity: 'WARNING', operator: 'GT', threshold: 90, metric: 'RAM' },
    { name: 'Disk space low', type: 'DISK_SPACE_LOW', severity: 'WARNING', operator: 'GT', threshold: 85, metric: 'DISK' },
  ] as const;

  for (const rule of rules) {
    const existing = await prisma.alertRule.findFirst({ where: { name: rule.name } });
    if (existing) continue;

    await prisma.alertRule.create({
      data: {
        name: rule.name,
        type: rule.type,
        severity: rule.severity,
        operator: rule.operator,
        threshold: rule.threshold,
        metric: rule.metric,
      },
    });
  }
  console.log(`✓ ${rules.length} alert rules`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
