import 'server-only';
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { monitoringService } from '@/services/monitoring.service';
import { systemService } from '@/services/system.service';
import { alertService } from '@/services/alert.service';

/**
 * Periodic monitoring engine (spec §7).
 *
 * A single in-process interval, started once per server instance. This is
 * deliberately not a queue or a cron container: for a single-node personal
 * command center an interval is the right amount of machinery, and the engine
 * is isolated behind this module so replacing it with BullMQ/Redis later
 * touches nothing else.
 */

interface EngineState {
  running: boolean;
  timer: NodeJS.Timeout | null;
  lastRunAt: string | null;
  lastError: string | null;
  runs: number;
}

const globalForEngine = globalThis as unknown as { dccMonitoringEngine?: EngineState };

function state(): EngineState {
  globalForEngine.dccMonitoringEngine ??= { running: false, timer: null, lastRunAt: null, lastError: null, runs: 0 };
  return globalForEngine.dccMonitoringEngine;
}

export function getMonitoringEngineState(): Readonly<EngineState> {
  return state();
}

export async function runMonitoringCycle(): Promise<void> {
  const engine = state();
  try {
    await monitoringService.runChecks();
    await systemService.recordSnapshot();

    const [services, system] = await Promise.all([monitoringService.listServices(), systemService.getMetrics()]);
    await alertService.evaluate({ services, system });

    engine.lastRunAt = new Date().toISOString();
    engine.lastError = null;
    engine.runs += 1;
  } catch (error) {
    engine.lastError = (error as Error).message;
    logger.error('Monitoring cycle failed', { error: engine.lastError });
  }
}

export function startMonitoringEngine(): void {
  const engine = state();
  if (engine.running) return;

  const intervalMs = getEnv().MONITORING_INTERVAL_SECONDS * 1000;
  engine.running = true;
  engine.timer = setInterval(() => {
    void runMonitoringCycle();
  }, intervalMs);
  engine.timer.unref?.();

  logger.info('Monitoring engine started', { intervalSeconds: getEnv().MONITORING_INTERVAL_SECONDS });
  void runMonitoringCycle();
}

export function stopMonitoringEngine(): void {
  const engine = state();
  if (engine.timer) clearInterval(engine.timer);
  engine.timer = null;
  engine.running = false;
}
