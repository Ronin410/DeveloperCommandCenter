import 'server-only';
import { request } from 'node:http';
import type { DockerProvider } from '@/services/ports';
import type { DockerContainer } from '@/types/domain';
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * Docker Engine API over the local unix socket.
 *
 * Read-only by design: listing containers requires no extra privileges beyond
 * socket access, and destructive actions (restart, stop) are deliberately not
 * implemented yet — the spec requires confirmation + authorization for those
 * (spec §12), which is phase 2.
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

function socketRequest<T>(path: string, socketPath: string, timeoutMs = 3000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const req = request({ socketPath, path, method: 'GET', timeout: timeoutMs }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if ((res.statusCode ?? 500) >= 400) {
          reject(new Error(`Docker API ${res.statusCode}: ${body.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(body) as T);
        } catch (error) {
          reject(error as Error);
        }
      });
    });

    req.on('timeout', () => req.destroy(new Error('Docker API timeout')));
    req.on('error', reject);
    req.end();
  });
}

export class DockerSocketProvider implements DockerProvider {
  private readonly socketPath = getEnv().DOCKER_SOCKET;

  async isAvailable(): Promise<boolean> {
    try {
      await socketRequest<{ ID: string }>('/v1.44/info', this.socketPath, 1500);
      return true;
    } catch (error) {
      logger.debug('Docker socket unavailable', { error: (error as Error).message });
      return false;
    }
  }

  async listContainers(): Promise<DockerContainer[]> {
    const containers = await socketRequest<DockerApiContainer[]>('/v1.44/containers/json?all=1', this.socketPath);

    return containers.map((container) => ({
      id: container.Id.slice(0, 12),
      name: container.Names[0]?.replace(/^\//, '') ?? container.Id.slice(0, 12),
      image: container.Image,
      state: (['running', 'exited', 'restarting', 'paused', 'created'] as const).includes(
        container.State as DockerContainer['state'],
      )
        ? (container.State as DockerContainer['state'])
        : 'exited',
      status: container.State === 'running' ? 'ONLINE' : container.State === 'restarting' ? 'WARNING' : 'OFFLINE',
      // Per-container CPU/RAM requires a stats stream per container; the MVP
      // keeps the listing cheap and reports usage once that job exists.
      cpuPct: 0,
      memoryMb: 0,
      memoryLimitMb: 0,
      uptimeSec: Math.max(0, Math.round(Date.now() / 1000 - container.Created)),
      ports: (container.Ports ?? [])
        .filter((port) => port.PublicPort)
        .map((port) => `${port.PublicPort}:${port.PrivatePort}`),
    }));
  }
}
