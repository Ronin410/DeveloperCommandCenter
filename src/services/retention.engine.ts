import 'server-only';
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { retentionService } from '@/services/retention.service';

/**
 * Periodic retention/downsampling engine (spec §36).
 *
 * Same single-interval shape as `monitoring.engine.ts`, deliberately on its
 * own timer rather than piggybacking on the monitoring cycle: it runs far
 * less often (once a day by default, not every 30 seconds) and touches
 * different tables, so coupling the two would just make the monitoring
 * cycle's timing depend on how much history there is to clean up.
 */

interface EngineState {
  running: boolean;
  timer: NodeJS.Timeout | null;
  lastRunAt: string | null;
  lastError: string | null;
  runs: number;
}

const globalForEngine = globalThis as unknown as { dccRetentionEngine?: EngineState };

function state(): EngineState {
  globalForEngine.dccRetentionEngine ??= { running: false, timer: null, lastRunAt: null, lastError: null, runs: 0 };
  return globalForEngine.dccRetentionEngine;
}

export function getRetentionEngineState(): Readonly<EngineState> {
  return state();
}

export async function runRetentionCycle(): Promise<void> {
  const engine = state();
  try {
    await retentionService.run();
    engine.lastRunAt = new Date().toISOString();
    engine.lastError = null;
    engine.runs += 1;
  } catch (error) {
    engine.lastError = (error as Error).message;
    logger.error('Retention cycle failed', { error: engine.lastError });
  }
}

export function startRetentionEngine(): void {
  const engine = state();
  if (engine.running) return;

  const intervalMs = getEnv().RETENTION_INTERVAL_HOURS * 60 * 60 * 1000;
  engine.running = true;
  engine.timer = setInterval(() => {
    void runRetentionCycle();
  }, intervalMs);
  engine.timer.unref?.();

  logger.info('Retention engine started', { intervalHours: getEnv().RETENTION_INTERVAL_HOURS });
  // Unlike the monitoring engine, this deliberately does NOT run once
  // immediately at boot: a restart is common (deploys, crashes) and a
  // multi-query cleanup pass isn't something every restart should pay for.
  // It runs for the first time after one full interval.
}

export function stopRetentionEngine(): void {
  const engine = state();
  if (engine.timer) clearInterval(engine.timer);
  engine.timer = null;
  engine.running = false;
}
