import 'server-only';
import { isMockMode } from '@/lib/env';
import { isDatabaseConfigured } from '@/database/client';
import type {
  AlertRepository,
  CalendarRepository,
  DatabaseStatsProvider,
  DeploymentRepository,
  DockerProvider,
  FocusRepository,
  GitProvider,
  MetricRepository,
  ProjectRepository,
  ServiceRepository,
  SystemMetricsProvider,
} from '@/services/ports';
import {
  MockAlertRepository,
  MockCalendarRepository,
  MockDatabaseStatsProvider,
  MockDeploymentRepository,
  MockDockerProvider,
  MockFocusRepository,
  MockGitProvider,
  MockMetricRepository,
  MockProjectRepository,
  MockServiceRepository,
  MockSystemMetricsProvider,
} from '@/services/mock/adapters';
import { PrismaServiceRepository } from '@/database/repositories/service.repository';
import {
  PrismaAlertRepository,
  PrismaCalendarRepository,
  PrismaDeploymentRepository,
  PrismaMetricRepository,
  PrismaProjectRepository,
} from '@/database/repositories/catalog.repository';
import { PrismaFocusRepository } from '@/database/repositories/focus.repository';
import { OsSystemMetricsProvider } from '@/services/providers/system.provider';
import { DockerSocketProvider } from '@/services/providers/docker.provider';
import { PostgresStatsProvider } from '@/services/providers/database.provider';
import { GitHubProvider } from '@/services/providers/github.provider';
import { getEnv } from '@/lib/env';

/**
 * Composition root (spec §33).
 *
 * One place decides mock vs. real for every port, so no service or route ever
 * needs to know which mode it is running in.
 */

export interface Container {
  services: ServiceRepository;
  metrics: MetricRepository;
  projects: ProjectRepository;
  deployments: DeploymentRepository;
  alerts: AlertRepository;
  focus: FocusRepository;
  calendar: CalendarRepository;
  system: SystemMetricsProvider;
  docker: DockerProvider;
  database: DatabaseStatsProvider;
  git: GitProvider;
}

const globalForContainer = globalThis as unknown as { dccContainer?: Container };

function build(): Container {
  const mock = isMockMode() || !isDatabaseConfigured();

  if (mock) {
    return {
      services: new MockServiceRepository(),
      metrics: new MockMetricRepository(),
      projects: new MockProjectRepository(),
      deployments: new MockDeploymentRepository(),
      alerts: new MockAlertRepository(),
      focus: new MockFocusRepository(),
      calendar: new MockCalendarRepository(),
      system: new MockSystemMetricsProvider(),
      docker: new MockDockerProvider(),
      database: new MockDatabaseStatsProvider(),
      git: new MockGitProvider(),
    };
  }

  return {
    services: new PrismaServiceRepository(),
    metrics: new PrismaMetricRepository(),
    projects: new PrismaProjectRepository(),
    deployments: new PrismaDeploymentRepository(),
    alerts: new PrismaAlertRepository(),
    focus: new PrismaFocusRepository(),
    calendar: new PrismaCalendarRepository(),
    system: new OsSystemMetricsProvider(),
    docker: new DockerSocketProvider(),
    database: new PostgresStatsProvider(),
    // GitHub falls back to mock data until a token is configured (spec §11).
    git: getEnv().GITHUB_TOKEN ? new GitHubProvider() : new MockGitProvider(),
  };
}

export function getContainer(): Container {
  globalForContainer.dccContainer ??= build();
  return globalForContainer.dccContainer;
}

/** Test helper: rebuilds the container from the current environment. */
export function resetContainer(): void {
  globalForContainer.dccContainer = undefined;
}
