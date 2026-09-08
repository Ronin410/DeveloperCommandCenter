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

describe('graphical service management (mock mode)', () => {
  it('creates a service, runs an immediate check, and it appears in the list', async () => {
    const created = await monitoringService.createService({
      name: 'My Custom API',
      description: 'A service I care about',
      kind: 'API',
      environment: 'PRODUCTION',
      healthUrl: 'http://127.0.0.1:1/health', // nothing listens here -> deterministic OFFLINE
      projectId: null,
    });

    expect(created.slug).toBe('my-custom-api');
    expect(created.status).toBe('OFFLINE'); // the immediate check already ran
    expect(created.isMonitored).toBe(true);

    const services = await monitoringService.listServices();
    expect(services.some((service) => service.id === created.id)).toBe(true);
  });

  it('assigns a unique slug when two services share a name', async () => {
    const first = await monitoringService.createService({
      name: 'Duplicate Name',
      description: null,
      kind: 'API',
      environment: 'PRODUCTION',
      healthUrl: 'http://127.0.0.1:1/health',
      projectId: null,
    });
    const second = await monitoringService.createService({
      name: 'Duplicate Name',
      description: null,
      kind: 'API',
      environment: 'PRODUCTION',
      healthUrl: 'http://127.0.0.1:1/health',
      projectId: null,
    });

    expect(first.slug).toBe('duplicate-name');
    expect(second.slug).toBe('duplicate-name-2');
  });

  it('pauses and resumes a custom service', async () => {
    const created = await monitoringService.createService({
      name: 'Pausable Service',
      description: null,
      kind: 'API',
      environment: 'PRODUCTION',
      healthUrl: 'http://127.0.0.1:1/health',
      projectId: null,
    });
    expect(created.isMonitored).toBe(true);

    const paused = await monitoringService.setMonitored(created.id, false);
    expect(paused.isMonitored).toBe(false);

    const resumed = await monitoringService.setMonitored(created.id, true);
    expect(resumed.isMonitored).toBe(true);
  });

  it('removes a custom service and its history', async () => {
    const created = await monitoringService.createService({
      name: 'Disposable Service',
      description: null,
      kind: 'API',
      environment: 'PRODUCTION',
      healthUrl: 'http://127.0.0.1:1/health',
      projectId: null,
    });

    await monitoringService.removeService(created.id);

    const services = await monitoringService.listServices();
    expect(services.some((service) => service.id === created.id)).toBe(false);
    await expect(monitoringService.getService(created.id)).rejects.toMatchObject({ status: 404 });
  });

  it('refuses to remove a built-in demo service', async () => {
    const services = await monitoringService.listServices();
    const builtIn = services[0]!;

    await expect(monitoringService.removeService(builtIn.id)).rejects.toMatchObject({ status: 400 });

    const stillThere = await monitoringService.listServices();
    expect(stillThere.some((service) => service.id === builtIn.id)).toBe(true);
  });

  it('runs a manual check-now even while paused', async () => {
    const created = await monitoringService.createService({
      name: 'Manual Check Service',
      description: null,
      kind: 'API',
      environment: 'PRODUCTION',
      healthUrl: 'http://127.0.0.1:1/health',
      projectId: null,
    });
    await monitoringService.setMonitored(created.id, false);

    const detail = await monitoringService.checkServiceNow(created.id);
    expect(detail.status).toBe('OFFLINE');
    expect(detail.checks.length).toBeGreaterThan(0);
  });

  it('rejects a manual check-now on a service with no health check URL', async () => {
    const services = await monitoringService.listServices();
    // Built-in mock services have no real healthUrl behind them.
    await expect(monitoringService.checkServiceNow(services[0]!.id)).rejects.toMatchObject({ status: 400 });
  });

  it('edits a custom service and regenerates its slug when the name changes', async () => {
    const created = await monitoringService.createService({
      name: 'Editable Service',
      description: null,
      kind: 'API',
      environment: 'DEVELOPMENT',
      healthUrl: 'http://127.0.0.1:1/health',
      projectId: null,
    });

    const updated = await monitoringService.updateService(created.id, {
      name: 'Renamed Service',
      kind: 'BACKEND',
      environment: 'STAGING',
    });

    expect(updated.name).toBe('Renamed Service');
    expect(updated.slug).toBe('renamed-service');
    expect(updated.kind).toBe('BACKEND');
    expect(updated.environment).toBe('STAGING');
  });

  it('re-checks a custom service immediately when its health URL is edited', async () => {
    const created = await monitoringService.createService({
      name: 'Repointed Service',
      description: null,
      kind: 'API',
      environment: 'PRODUCTION',
      healthUrl: 'http://127.0.0.1:1/health', // deterministic OFFLINE
      projectId: null,
    });
    expect(created.status).toBe('OFFLINE');

    const updated = await monitoringService.updateService(created.id, { healthUrl: 'http://127.0.0.1:2/health' });
    expect(updated.status).toBe('OFFLINE'); // still nothing listening, but the check re-ran
    expect(updated.checks.length).toBeGreaterThanOrEqual(2);
  });

  it('refuses to edit a built-in demo service', async () => {
    const services = await monitoringService.listServices();
    const builtIn = services[0]!;

    await expect(monitoringService.updateService(builtIn.id, { name: 'Hacked' })).rejects.toMatchObject({ status: 400 });
  });
});

describe('docker container actions (mock mode)', () => {
  it('stops and restarts a container', async () => {
    const before = await dockerService.listContainers();
    const target = before.containers[0]!;
    expect(target.state).toBe('running');

    await dockerService.stop(target.id);
    const afterStop = await dockerService.listContainers();
    const stopped = afterStop.containers.find((c) => c.id === target.id)!;
    expect(stopped.state).toBe('exited');
    expect(stopped.status).toBe('OFFLINE');
    expect(stopped.cpuPct).toBe(0);

    await dockerService.restart(target.id);
    const afterRestart = await dockerService.listContainers();
    expect(afterRestart.containers.find((c) => c.id === target.id)!.state).toBe('running');
  });

  it('returns log lines for a container', async () => {
    const { containers } = await dockerService.listContainers();
    const lines = await dockerService.logs(containers[0]!.id);
    expect(lines.length).toBeGreaterThan(0);
  });

  it('rejects an action on an unknown container id', async () => {
    await expect(dockerService.restart('ctr_does_not_exist')).rejects.toMatchObject({ status: 404 });
    await expect(dockerService.stop('ctr_does_not_exist')).rejects.toMatchObject({ status: 404 });
    await expect(dockerService.logs('ctr_does_not_exist')).rejects.toMatchObject({ status: 404 });
  });
});

describe('database deep metrics (mock mode)', () => {
  it('reports table sizes and slow queries', async () => {
    const deep = await databaseService.getDeepStats();

    expect(deep.tables.length).toBeGreaterThan(0);
    expect(deep.slowQueriesAvailable).toBe(true);
    expect(deep.slowQueries.length).toBeGreaterThan(0);
    expect(deep.walArchiving).not.toBeNull();
  });
});

describe('historical metric charts (mock mode)', () => {
  it('returns a bounded, chronologically-ordered series for a metric type', async () => {
    const points = await systemService.getHistory('CPU', 10);

    expect(points).toHaveLength(10);
    for (const point of points) {
      expect(point.value).toBeGreaterThan(0);
      expect(new Date(point.timestamp).toString()).not.toBe('Invalid Date');
    }
    expect(points[0]!.timestamp <= points[points.length - 1]!.timestamp).toBe(true);
  });
});
