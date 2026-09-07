import { describe, expect, it } from 'vitest';
import { monitoringService } from '@/services/monitoring.service';
import { projectService, deploymentService } from '@/services/project.service';
import { systemService } from '@/services/system.service';
import { dockerService } from '@/services/docker.service';
import { databaseService } from '@/services/database.service';
import { SERVICE_STATUSES } from '@/types/domain';

/** The service layer must be fully usable in mock mode (spec §33). */
describe('service layer in mock mode', () => {
  it('lists services with valid statuses', async () => {
    const services = await monitoringService.listServices();

    expect(services.length).toBeGreaterThan(0);
    for (const service of services) {
      expect(SERVICE_STATUSES).toContain(service.status);
      expect(service.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('filters services by environment', async () => {
    const staging = await monitoringService.listServices({ environment: 'STAGING' });
    expect(staging.every((service) => service.environment === 'STAGING')).toBe(true);
  });

  it('returns a service detail with check history', async () => {
    const detail = await monitoringService.getService('api');

    expect(detail.name).toBe('API');
    expect(detail.checks.length).toBeGreaterThan(5);
    expect(detail.checks[0]?.createdAt).toBeTypeOf('string');
  });

  it('throws a 404-shaped error for an unknown service', async () => {
    await expect(monitoringService.getService('does-not-exist')).rejects.toMatchObject({ status: 404 });
  });

  it('classifies a failing endpoint as OFFLINE', async () => {
    const result = await monitoringService.checkEndpoint('http://127.0.0.1:1/health');

    expect(result.status).toBe('OFFLINE');
    expect(result.error).toBeTruthy();
  });

  it('reports project health and deployments', async () => {
    const projects = await projectService.list();
    expect(projects.length).toBeGreaterThan(0);
    expect(projects[0]?.healthyServices).toBeLessThanOrEqual(projects[0]!.serviceCount);

    const deployments = await deploymentService.list({ limit: 3 });
    expect(deployments).toHaveLength(3);
    expect(deployments[0]!.startedAt >= deployments[1]!.startedAt).toBe(true);
  });

  it('exposes system, docker and database metrics without secrets', async () => {
    const metrics = await systemService.getMetrics();
    expect(metrics.cpuPct).toBeGreaterThan(0);

    const docker = await dockerService.listContainers();
    expect(docker.available).toBe(true);
    expect(docker.containers.length).toBeGreaterThan(0);

    const database = await databaseService.getStats();
    expect(database.status).toBe('ONLINE');
    expect(JSON.stringify(database)).not.toMatch(/password|secret|postgresql:\/\//i);
  });
});
