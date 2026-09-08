import 'server-only';
import { request } from 'node:http';
import type { DockerProvider } from '@/services/ports';
import type { DockerContainer } from '@/types/domain';
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { notFound } from '@/lib/errors';

/**
 * Docker Engine API over the local unix socket.
 *
 * Phase 1 was read-only by design (spec §12 requires confirmation +
 * authorization for restart/stop, which land here in phase 2 gated by the
 * route layer — see `src/app/api/docker/[id]/*`). Per-container CPU/RAM also
 * lands here: it needs one `/stats?stream=0` request per container, so the
 * listing is no longer "free" the way `containers/json` alone was.
 */

interface DockerApiContainer {
  Id: string;
  Names: string[];
  Image: string;
  State: string;
  Status: string;
  Created: number;
  Ports?: { PrivatePort: number; PublicPort?: number }[];
}

/** Shape of `GET /containers/{id}/stats?stream=0` — only the fields the CPU/RAM formulas need. */
interface DockerApiStats {
  cpu_stats: {
    cpu_usage: { total_usage: number };
    system_cpu_usage?: number;
    online_cpus?: number;
  };
  precpu_stats: {
    cpu_usage: { total_usage: number };
    system_cpu_usage?: number;
  };
  memory_stats: {
    usage?: number;
    stats?: { cache?: number };
    limit?: number;
  };
}

interface RawResponse {
  status: number;
  body: Buffer;
}

function socketRequest(
  path: string,
  socketPath: string,
  options: { method?: string; timeoutMs?: number } = {},
): Promise<RawResponse> {
  const { method = 'GET', timeoutMs = 3000 } = options;

  return new Promise<RawResponse>((resolve, reject) => {
    const req = request({ socketPath, path, method, timeout: timeoutMs }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 500, body: Buffer.concat(chunks) }));
    });

    req.on('timeout', () => req.destroy(new Error('Docker API timeout')));
    req.on('error', reject);
    req.end();
  });
}

async function socketRequestJson<T>(
  path: string,
  socketPath: string,
  options: { method?: string; timeoutMs?: number } = {},
): Promise<T> {
  const { status, body } = await socketRequest(path, socketPath, options);
  const text = body.toString('utf8');

  if (status === 404) throw notFound('Container not found');
  if (status >= 400) throw new Error(`Docker API ${status}: ${text.slice(0, 200)}`);

  return JSON.parse(text) as T;
}

/**
 * Docker multiplexes stdout/stderr into frames of `[stream(1), 0,0,0, size(4 BE)]`
 * + payload when the container was created without a TTY (the common case).
 * A container started with a TTY sends raw bytes instead — if the frame
 * headers don't parse as a consistent sequence of valid lengths, this falls
 * back to treating the whole buffer as plain text rather than producing
 * garbage.
 */
function demuxLogs(buffer: Buffer): string[] {
  const lines: string[] = [];
  let offset = 0;

  while (offset + 8 <= buffer.length) {
    const streamType = buffer.readUInt8(offset);
    const size = buffer.readUInt32BE(offset + 4);

    if (streamType > 2 || offset + 8 + size > buffer.length) {
      // Doesn't look like a valid frame stream — bail out to the raw-text fallback below.
      return buffer.toString('utf8').split('\n').filter(Boolean);
    }

    const payload = buffer.subarray(offset + 8, offset + 8 + size).toString('utf8');
    lines.push(...payload.split('\n').filter(Boolean));
    offset += 8 + size;
  }

  return lines;
}

/** CPU % across all cores, the same formula `docker stats` itself uses. */
function cpuPercent(stats: DockerApiStats): number {
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta = (stats.cpu_stats.system_cpu_usage ?? 0) - (stats.precpu_stats.system_cpu_usage ?? 0);
  if (cpuDelta <= 0 || systemDelta <= 0) return 0;

  const cpuCount = stats.cpu_stats.online_cpus ?? 1;
  return Math.round(((cpuDelta / systemDelta) * cpuCount * 100 + Number.EPSILON) * 10) / 10;
}

export class DockerSocketProvider implements DockerProvider {
  private readonly socketPath = getEnv().DOCKER_SOCKET;

  async isAvailable(): Promise<boolean> {
    try {
      await socketRequestJson<{ ID: string }>('/v1.44/info', this.socketPath, { timeoutMs: 1500 });
      return true;
    } catch (error) {
      logger.debug('Docker socket unavailable', { error: (error as Error).message });
      return false;
    }
  }

  async listContainers(): Promise<DockerContainer[]> {
    const containers = await socketRequestJson<DockerApiContainer[]>('/v1.44/containers/json?all=1', this.socketPath);

    return Promise.all(
      containers.map(async (container) => {
        const id = container.Id.slice(0, 12);
        const running = container.State === 'running';
        const usage = running ? await this.readStats(container.Id) : null;

        return {
          id,
          name: container.Names[0]?.replace(/^\//, '') ?? id,
          image: container.Image,
          state: (['running', 'exited', 'restarting', 'paused', 'created'] as const).includes(
            container.State as DockerContainer['state'],
          )
            ? (container.State as DockerContainer['state'])
            : 'exited',
          status: container.State === 'running' ? 'ONLINE' : container.State === 'restarting' ? 'WARNING' : 'OFFLINE',
          cpuPct: usage?.cpuPct ?? 0,
          memoryMb: usage?.memoryMb ?? 0,
          memoryLimitMb: usage?.memoryLimitMb ?? 0,
          uptimeSec: Math.max(0, Math.round(Date.now() / 1000 - container.Created)),
          ports: (container.Ports ?? [])
            .filter((port) => port.PublicPort)
            .map((port) => `${port.PublicPort}:${port.PrivatePort}`),
        };
      }),
    );
  }

  /** One-shot (non-streaming) stats read. Best-effort: a container that dies mid-read just reports zero. */
  private async readStats(fullId: string): Promise<{ cpuPct: number; memoryMb: number; memoryLimitMb: number } | null> {
    try {
      const stats = await socketRequestJson<DockerApiStats>(`/v1.44/containers/${fullId}/stats?stream=0`, this.socketPath, {
        timeoutMs: 2000,
      });
      const memoryUsage = (stats.memory_stats.usage ?? 0) - (stats.memory_stats.stats?.cache ?? 0);

      return {
        cpuPct: cpuPercent(stats),
        memoryMb: Math.round(Math.max(0, memoryUsage) / (1024 * 1024)),
        memoryLimitMb: Math.round((stats.memory_stats.limit ?? 0) / (1024 * 1024)),
      };
    } catch (error) {
      logger.debug('Could not read container stats', { container: fullId, error: (error as Error).message });
      return null;
    }
  }

  async restart(id: string): Promise<void> {
    const { status, body } = await socketRequest(`/v1.44/containers/${id}/restart?t=10`, this.socketPath, {
      method: 'POST',
      timeoutMs: 15_000,
    });
    if (status === 404) throw notFound('Container not found');
    if (status >= 400) throw new Error(`Docker API ${status}: ${body.toString('utf8').slice(0, 200)}`);
  }

  async stop(id: string): Promise<void> {
    const { status, body } = await socketRequest(`/v1.44/containers/${id}/stop?t=10`, this.socketPath, {
      method: 'POST',
      timeoutMs: 15_000,
    });
    if (status === 404) throw notFound('Container not found');
    if (status >= 400) throw new Error(`Docker API ${status}: ${body.toString('utf8').slice(0, 200)}`);
  }

  async logs(id: string, tail = 200): Promise<string[]> {
    const { status, body } = await socketRequest(
      `/v1.44/containers/${id}/logs?stdout=1&stderr=1&tail=${Math.max(1, Math.min(2000, tail))}`,
      this.socketPath,
      { timeoutMs: 5000 },
    );
    if (status === 404) throw notFound('Container not found');
    if (status >= 400) throw new Error(`Docker API ${status}: ${body.toString('utf8').slice(0, 200)}`);

    return demuxLogs(body);
  }
}
