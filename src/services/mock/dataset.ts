import type {
  AlertRecord,
  CalendarEventRecord,
  DeploymentRecord,
  Environment,
  GitRepositorySummary,
  ProjectSummary,
  ServiceKind,
  ServiceStatus,
} from '@/types/domain';

/**
 * Deterministic simulated infrastructure (spec §33).
 *
 * Values wobble over time so charts and status pills look alive, but they are
 * derived from a seeded PRNG keyed by (slug, minute) — the dashboard therefore
 * renders identically on the server and on the client for a given minute, which
 * keeps hydration stable and makes tests reproducible.
 */

export function seededRandom(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 100000) / 100000;
}

export function wobble(seed: string, base: number, spread: number, bucketMs = 60_000): number {
  const bucket = Math.floor(Date.now() / bucketMs);
  const noise = seededRandom(`${seed}:${bucket}`) - 0.5;
  return Math.round((base + noise * spread * 2) * 10) / 10;
}

export interface MockServiceSeed {
  id: string;
  slug: string;
  name: string;
  description: string;
  kind: ServiceKind;
  environment: Environment;
  version: string;
  projectId: string | null;
  baseLatency: number;
  baseUptime: number;
  /** Forced status; when omitted the status is derived from latency. */
  status?: ServiceStatus;
}

export const MOCK_SERVICES: MockServiceSeed[] = [
  {
    id: 'svc_api',
    slug: 'api',
    name: 'API',
    description: 'Public REST API gateway',
    kind: 'API',
    environment: 'PRODUCTION',
    version: 'v2.4.18',
    projectId: 'prj_pasitos',
    baseLatency: 128,
    baseUptime: 99.98,
  },
  {
    id: 'svc_database',
    slug: 'database',
    name: 'DATABASE',
    description: 'Primary PostgreSQL cluster',
    kind: 'DATABASE',
    environment: 'PRODUCTION',
    version: '16.4',
    projectId: null,
    baseLatency: 8,
    baseUptime: 99.99,
  },
  {
    id: 'svc_redis',
    slug: 'redis',
    name: 'REDIS',
    description: 'Cache and queue backend',
    kind: 'CACHE',
    environment: 'PRODUCTION',
    version: '7.4',
    projectId: null,
    baseLatency: 3,
    baseUptime: 99.97,
  },
  {
    id: 'svc_docker',
    slug: 'docker',
    name: 'DOCKER',
    description: 'Container runtime host',
    kind: 'CONTAINER',
    environment: 'PRODUCTION',
    version: '27.3',
    projectId: null,
    baseLatency: 12,
    baseUptime: 99.9,
  },
  {
    id: 'svc_web',
    slug: 'web',
    name: 'WEB FRONTEND',
    description: 'Next.js frontend',
    kind: 'FRONTEND',
    environment: 'PRODUCTION',
    version: 'v3.1.0',
    projectId: 'prj_pasitos_web',
    baseLatency: 210,
    baseUptime: 99.94,
  },
  {
    id: 'svc_nginx',
    slug: 'nginx',
    name: 'NGINX',
    description: 'Reverse proxy / TLS termination',
    kind: 'PROXY',
    environment: 'PRODUCTION',
    version: '1.27',
    projectId: null,
    baseLatency: 5,
    baseUptime: 99.99,
  },
  {
    id: 'svc_staging_api',
    slug: 'staging-api',
    name: 'STAGING API',
    description: 'Pre-production API',
    kind: 'API',
    environment: 'STAGING',
    version: 'v2.5.0-rc.3',
    projectId: 'prj_pasitos',
    baseLatency: 340,
    baseUptime: 98.2,
    status: 'WARNING',
  },
  {
    id: 'svc_mobile_api',
    slug: 'mobile-api',
    name: 'MOBILE BFF',
    description: 'Backend-for-frontend for the mobile app',
    kind: 'BACKEND',
    environment: 'DEVELOPMENT',
    version: 'v0.9.2',
    projectId: 'prj_pasitos_mobile',
    baseLatency: 180,
    baseUptime: 96.5,
  },
];

export const MOCK_PROJECTS: Omit<ProjectSummary, 'serviceCount' | 'healthyServices' | 'lastDeploymentAt'>[] = [
  {
    id: 'prj_pasitos',
    slug: 'pasitos-api',
    name: 'Pasitos API',
    description: 'Core API powering the Pasitos platform',
    repository: 'github.com/acme/pasitos-api',
    environment: 'PRODUCTION',
    status: 'ACTIVE',
    version: 'v2.4.18',
  },
  {
    id: 'prj_pasitos_web',
    slug: 'pasitos-web',
    name: 'Pasitos Web',
    description: 'Customer-facing web application',
    repository: 'github.com/acme/pasitos-web',
    environment: 'PRODUCTION',
    status: 'ACTIVE',
    version: 'v3.1.0',
  },
  {
    id: 'prj_pasitos_mobile',
    slug: 'pasitos-mobile',
    name: 'Pasitos Mobile',
    description: 'React Native mobile client',
    repository: 'github.com/acme/pasitos-mobile',
    environment: 'DEVELOPMENT',
    status: 'ACTIVE',
    version: 'v0.9.2',
  },
  {
    id: 'prj_dcc',
    slug: 'developer-command-center',
    name: 'Developer Command Center',
    description: 'This platform, monitoring itself',
    repository: 'github.com/acme/developer-command-center',
    environment: 'STAGING',
    status: 'ACTIVE',
    version: 'v0.1.0',
  },
];

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export function mockDeployments(): DeploymentRecord[] {
  return [
    {
      id: 'dep_1',
      projectId: 'prj_pasitos',
      projectName: 'Pasitos API',
      environment: 'PRODUCTION',
      version: 'v2.4.18',
      branch: 'main',
      commitSha: 'a8d32f1',
      commitMessage: 'fix(auth): rotate refresh tokens on reuse',
      status: 'SUCCESS',
      author: 'alejandro',
      durationSec: 214,
      startedAt: minutesAgo(25),
      finishedAt: minutesAgo(21),
    },
    {
      id: 'dep_2',
      projectId: 'prj_pasitos_web',
      projectName: 'Pasitos Web',
      environment: 'PRODUCTION',
      version: 'v3.1.0',
      branch: 'main',
      commitSha: '4b91cc7',
      commitMessage: 'feat(dashboard): responsive service grid',
      status: 'SUCCESS',
      author: 'alejandro',
      durationSec: 189,
      startedAt: minutesAgo(96),
      finishedAt: minutesAgo(93),
    },
    {
      id: 'dep_3',
      projectId: 'prj_pasitos',
      projectName: 'Pasitos API',
      environment: 'STAGING',
      version: 'v2.5.0-rc.3',
      branch: 'release/2.5.0',
      commitSha: '77ce012',
      commitMessage: 'chore(deps): bump prisma',
      status: 'RUNNING',
      author: 'ci-bot',
      durationSec: null,
      startedAt: minutesAgo(3),
      finishedAt: null,
    },
    {
      id: 'dep_4',
      projectId: 'prj_pasitos_mobile',
      projectName: 'Pasitos Mobile',
      environment: 'DEVELOPMENT',
      version: 'v0.9.2',
      branch: 'feature/offline-mode',
      commitSha: 'e30a5b8',
      commitMessage: 'feat(offline): cache last sync payload',
      status: 'FAILED',
      author: 'maria',
      durationSec: 78,
      startedAt: minutesAgo(320),
      finishedAt: minutesAgo(318),
    },
    {
      id: 'dep_5',
      projectId: 'prj_dcc',
      projectName: 'Developer Command Center',
      environment: 'STAGING',
      version: 'v0.1.0',
      branch: 'main',
      commitSha: '1f0c9de',
      commitMessage: 'feat: initial command center MVP',
      status: 'SUCCESS',
      author: 'alejandro',
      durationSec: 132,
      startedAt: minutesAgo(640),
      finishedAt: minutesAgo(638),
    },
  ];
}

export function mockAlerts(): AlertRecord[] {
  return [
    {
      id: 'alr_1',
      type: 'HIGH_LATENCY',
      severity: 'WARNING',
      title: 'High response time on STAGING API',
      description: 'p95 latency above 300 ms for the last 10 minutes.',
      serviceId: 'svc_staging_api',
      serviceName: 'STAGING API',
      status: 'ACTIVE',
      occurrences: 4,
      createdAt: minutesAgo(11),
      acknowledgedAt: null,
      resolvedAt: null,
    },
    {
      id: 'alr_2',
      type: 'DEPLOYMENT_FAILED',
      severity: 'ERROR',
      title: 'Deployment failed — Pasitos Mobile',
      description: 'Build step "expo prebuild" exited with code 1.',
      serviceId: 'svc_mobile_api',
      serviceName: 'MOBILE BFF',
      status: 'ACKNOWLEDGED',
      occurrences: 1,
      createdAt: minutesAgo(318),
      acknowledgedAt: minutesAgo(300),
      resolvedAt: null,
    },
    {
      id: 'alr_3',
      type: 'HIGH_CPU',
      severity: 'INFO',
      title: 'CPU spike on docker host',
      description: 'CPU reached 78% during the nightly backup window.',
      serviceId: 'svc_docker',
      serviceName: 'DOCKER',
      status: 'RESOLVED',
      occurrences: 2,
      createdAt: minutesAgo(700),
      acknowledgedAt: minutesAgo(690),
      resolvedAt: minutesAgo(660),
    },
  ];
}

export function mockCalendarEvents(): CalendarEventRecord[] {
  const today = new Date();
  const at = (hour: number, minute: number): string => {
    const date = new Date(today);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  };

  return [
    {
      id: 'evt_1',
      title: 'Development',
      description: 'Deep work block — Pasitos API v2.5',
      location: null,
      startsAt: at(10, 30),
      endsAt: at(12, 30),
      allDay: false,
      source: 'local',
    },
    {
      id: 'evt_2',
      title: 'Lunch',
      description: null,
      location: null,
      startsAt: at(13, 0),
      endsAt: at(14, 0),
      allDay: false,
      source: 'local',
    },
    {
      id: 'evt_3',
      title: 'Project Work',
      description: 'Developer Command Center — dashboard polish',
      location: null,
      startsAt: at(15, 0),
      endsAt: at(17, 0),
      allDay: false,
      source: 'local',
    },
  ];
}

export function mockRepositories(): GitRepositorySummary[] {
  return [
    {
      id: 'repo_1',
      name: 'pasitos-api',
      fullName: 'acme/pasitos-api',
      defaultBranch: 'main',
      openPullRequests: 3,
      openIssues: 12,
      lastCommitSha: 'a8d32f1',
      lastCommitMessage: 'fix(auth): rotate refresh tokens on reuse',
      lastCommitAuthor: 'alejandro',
      lastCommitAt: minutesAgo(28),
      workflowStatus: 'success',
    },
    {
      id: 'repo_2',
      name: 'pasitos-web',
      fullName: 'acme/pasitos-web',
      defaultBranch: 'main',
      openPullRequests: 1,
      openIssues: 5,
      lastCommitSha: '4b91cc7',
      lastCommitMessage: 'feat(dashboard): responsive service grid',
      lastCommitAuthor: 'alejandro',
      lastCommitAt: minutesAgo(97),
      workflowStatus: 'success',
    },
    {
      id: 'repo_3',
      name: 'pasitos-mobile',
      fullName: 'acme/pasitos-mobile',
      defaultBranch: 'develop',
      openPullRequests: 6,
      openIssues: 21,
      lastCommitSha: 'e30a5b8',
      lastCommitMessage: 'feat(offline): cache last sync payload',
      lastCommitAuthor: 'maria',
      lastCommitAt: minutesAgo(321),
      workflowStatus: 'failure',
    },
    {
      id: 'repo_4',
      name: 'developer-command-center',
      fullName: 'acme/developer-command-center',
      defaultBranch: 'main',
      openPullRequests: 2,
      openIssues: 8,
      lastCommitSha: '1f0c9de',
      lastCommitMessage: 'feat: initial command center MVP',
      lastCommitAuthor: 'alejandro',
      lastCommitAt: minutesAgo(641),
      workflowStatus: 'running',
    },
  ];
}
