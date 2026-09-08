/**
 * Server startup hook (Next.js `instrumentation.ts`).
 *
 * Runs once per server instance, before the first request is served. Two jobs
 * that used to be awkward elsewhere live here:
 *
 *  1. Creating the first administrator and registering the DCC's own API, so a
 *     fresh deployment is usable — and not empty — without a manual seed step.
 *  2. Starting the monitoring engine — previously kicked off by the dashboard
 *     layout, which meant health checks only began once somebody logged in.
 *
 * Failures are logged and swallowed: a missing schema or an unreachable
 * database must not prevent the server from booting, because the login page and
 * /api/health are how you diagnose exactly that.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { logger } = await import('@/lib/logger');

  try {
    const { bootstrapAdmin, bootstrapCatalogue } = await import('@/database/bootstrap');

    const admin = await bootstrapAdmin();
    if (admin !== 'skipped') logger.info('Administrator bootstrap', { result: admin });

    const catalogue = await bootstrapCatalogue();
    if (catalogue !== 'skipped') logger.info('Catalogue bootstrap', { result: catalogue });
  } catch (error) {
    logger.error('Administrator bootstrap failed', { error: (error as Error).message });
  }

  try {
    const { isMockMode } = await import('@/lib/env');
    if (!isMockMode()) {
      const { startMonitoringEngine } = await import('@/services/monitoring.engine');
      startMonitoringEngine();

      const { startRetentionEngine } = await import('@/services/retention.engine');
      startRetentionEngine();
    }
  } catch (error) {
    logger.error('Could not start the monitoring engine', { error: (error as Error).message });
  }
}
