import 'server-only';
import { cpus, freemem, loadavg, totalmem, uptime } from 'node:os';
import { statfs } from 'node:fs/promises';
import type { SystemMetricsProvider } from '@/services/ports';
import type { SystemMetrics } from '@/types/domain';
import { logger } from '@/lib/logger';

/**
 * Host metrics from Node's `os` module (spec §8).
 *
 * CPU usage is sampled as the delta between two reads of the CPU time
 * counters: an instantaneous read reports average-since-boot, which never moves
 * and looks broken on a dashboard.
 */

let previousCpu: { idle: number; total: number } | null = null;

function cpuSnapshot(): { idle: number; total: number } {
  let idle = 0;
  let total = 0;
  for (const cpu of cpus()) {
    for (const value of Object.values(cpu.times)) total += value;
    idle += cpu.times.idle;
  }
  return { idle, total };
}

function cpuUsagePct(): number {
  const current = cpuSnapshot();
  const previous = previousCpu;
  previousCpu = current;

  if (!previous) return 0;
  const idleDelta = current.idle - previous.idle;
  const totalDelta = current.total - previous.total;
  if (totalDelta <= 0) return 0;

  return Math.round((1 - idleDelta / totalDelta) * 1000) / 10;
}

async function diskUsagePct(): Promise<number> {
  try {
    const stats = await statfs('/');
    const total = Number(stats.blocks) * Number(stats.bsize);
    const available = Number(stats.bavail) * Number(stats.bsize);
    if (total <= 0) return 0;
    return Math.round(((total - available) / total) * 1000) / 10;
  } catch (error) {
    logger.debug('statfs unavailable', { error: (error as Error).message });
    return 0;
  }
}

export class OsSystemMetricsProvider implements SystemMetricsProvider {
  async read(): Promise<SystemMetrics> {
    const total = totalmem();
    const free = freemem();
    const [one = 0, five = 0, fifteen = 0] = loadavg();

    return {
      cpuPct: cpuUsagePct(),
      ramPct: Math.round(((total - free) / total) * 1000) / 10,
      diskPct: await diskUsagePct(),
      networkMbps: 0,
      uptimeSec: Math.round(uptime()),
      loadAverage: [one, five, fifteen],
      // Request/error/latency counters come from the monitoring engine once
      // metrics are persisted; zero is honest until then.
      requestsPerMin: 0,
      errorRatePct: 0,
      avgLatencyMs: 0,
      collectedAt: new Date().toISOString(),
    };
  }
}
