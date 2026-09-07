import 'server-only';
import { getContainer } from '@/services/container';
import type { MetricType, SystemMetrics } from '@/types/domain';

/** SystemService — host-level metrics and their history (spec §8). */
export class SystemService {
  private get container() {
    return getContainer();
  }

  async getMetrics(): Promise<SystemMetrics> {
    return this.container.system.read();
  }

  async getHistory(type: MetricType, limit = 60): Promise<{ value: number; timestamp: string }[]> {
    return this.container.metrics.history({ type, limit });
  }

  /** Persists the current snapshot so charts have real history (spec §8). */
  async recordSnapshot(): Promise<void> {
    const metrics = await this.getMetrics();
    const entries: [MetricType, number, string][] = [
      ['CPU', metrics.cpuPct, '%'],
      ['RAM', metrics.ramPct, '%'],
      ['DISK', metrics.diskPct, '%'],
      ['LATENCY', metrics.avgLatencyMs, 'ms'],
      ['ERROR_RATE', metrics.errorRatePct, '%'],
    ];

    await Promise.all(
      entries.map(([type, value, unit]) => this.container.metrics.record({ type, value, unit })),
    );
  }
}

export const systemService = new SystemService();
