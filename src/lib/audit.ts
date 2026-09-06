import 'server-only';
import { getPrisma, isDatabaseConfigured } from '@/database/client';
import { isMockMode } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * Audit trail (spec §24). Always logged; additionally persisted when a real
 * database is available. Failures here must never break the request.
 */
export async function audit(input: {
  action: string;
  resource: string;
  resourceId?: string | null;
  userId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  logger.info(`audit:${input.action}`, {
    resource: input.resource,
    resourceId: input.resourceId ?? undefined,
    userId: input.userId ?? undefined,
    ip: input.ipAddress ?? undefined,
  });

  if (isMockMode() || !isDatabaseConfigured()) return;

  try {
    await getPrisma().auditLog.create({
      data: {
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        userId: input.userId ?? null,
        ipAddress: input.ipAddress ?? null,
        metadata: (input.metadata ?? undefined) as never,
      },
    });
  } catch (error) {
    logger.error('Failed to persist audit log', { error: (error as Error).message });
  }
}
