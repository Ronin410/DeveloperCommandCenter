/**
 * Domain types shared by services, API and UI.
 *
 * These are intentionally decoupled from Prisma's generated types: the browser
 * bundle must never import the database client, and the API contract should be
 * able to outlive a schema refactor.
 */

export const SERVICE_STATUSES = ['ONLINE', 'WARNING', 'OFFLINE', 'UNKNOWN'] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export const SERVICE_KINDS = [
  'API',
  'BACKEND',
  'FRONTEND',
  'DATABASE',
  'CACHE',
  'CONTAINER',
  'PROXY',
  'SERVER',
  'EXTERNAL',
] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];

export const ENVIRONMENTS = ['DEVELOPMENT', 'STAGING', 'PRODUCTION'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const PROJECT_STATUSES = ['ACTIVE', 'PAUSED', 'ARCHIVED'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const DEPLOYMENT_STATUSES = ['SUCCESS', 'RUNNING', 'FAILED', 'CANCELLED'] as const;
export type DeploymentStatus = (typeof DEPLOYMENT_STATUSES)[number];

export const METRIC_TYPES = [
  'CPU',
  'RAM',
  'DISK',
  'NETWORK',
  'UPTIME',
  'REQUESTS',
  'ERROR_RATE',
  'LATENCY',
] as const;
export type MetricType = (typeof METRIC_TYPES)[number];

export const ALERT_SEVERITIES = ['INFO', 'WARNING', 'ERROR', 'CRITICAL'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_STATUSES = ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const ALERT_TYPES = [
  'API_DOWN',
  'HIGH_LATENCY',
  'HIGH_CPU',
  'HIGH_MEMORY',
  'DISK_SPACE_LOW',
  'DEPLOYMENT_FAILED',
  'DATABASE_ERROR',
  'CUSTOM',
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ROLES = ['ADMIN', 'OPERATOR', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

export const FOCUS_SESSION_TYPES = ['FOCUS', 'SHORT_BREAK', 'LONG_BREAK'] as const;
export type FocusSessionType = (typeof FOCUS_SESSION_TYPES)[number];

export const FOCUS_SESSION_STATUSES = ['RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const;
export type FocusSessionStatus = (typeof FOCUS_SESSION_STATUSES)[number];

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface ServiceSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: ServiceKind;
  environment: Environment;
  status: ServiceStatus;
  latencyMs: number | null;
  uptimePct: number | null;
  version: string | null;
  lastCheckAt: string | null;
  projectId: string | null;
  projectName: string | null;
  /** Whether the health-check engine currently polls this service. */
  isMonitored: boolean;
}

export interface ServiceCheckRecord {
  id: string;
  serviceId: string;
  status: ServiceStatus;
  responseTime: number | null;
  httpStatus: number | null;
  error: string | null;
  createdAt: string;
}

export interface ServiceDetail extends ServiceSummary {
  checks: ServiceCheckRecord[];
}

export interface SystemMetrics {
  cpuPct: number;
  ramPct: number;
  diskPct: number;
  networkMbps: number;
  uptimeSec: number;
  loadAverage: [number, number, number];
  requestsPerMin: number;
  errorRatePct: number;
  avgLatencyMs: number;
  collectedAt: string;
}

export interface ProjectSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  repository: string | null;
  environment: Environment;
  status: ProjectStatus;
  version: string | null;
  serviceCount: number;
  healthyServices: number;
  lastDeploymentAt: string | null;
}

export interface DeploymentRecord {
  id: string;
  projectId: string;
  projectName: string;
  environment: Environment;
  version: string;
  branch: string;
  commitSha: string;
  commitMessage: string | null;
  status: DeploymentStatus;
  author: string;
  durationSec: number | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface AlertRecord {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string | null;
  serviceId: string | null;
  serviceName: string | null;
  status: AlertStatus;
  occurrences: number;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: 'running' | 'exited' | 'restarting' | 'paused' | 'created';
  status: ServiceStatus;
  cpuPct: number;
  memoryMb: number;
  memoryLimitMb: number;
  uptimeSec: number;
  ports: string[];
}

export interface DatabaseStats {
  status: ServiceStatus;
  connections: number;
  maxConnections: number;
  storageMb: number;
  storageLimitMb: number;
  latencyMs: number;
  cpuPct: number;
  memoryPct: number;
  lastBackupAt: string | null;
  version: string;
}

/** One row from `pg_stat_user_tables`, ordered by total size (spec §13 "deep metrics"). */
export interface TableSizeStat {
  name: string;
  rowEstimate: number;
  totalMb: number;
  indexMb: number;
}

/**
 * One row from `pg_stat_statements`, when that extension is installed.
 * `query` is Postgres's own normalized text (`$1`, `$2`, … placeholders
 * instead of literal values), so it never carries the parameters a query was
 * run with.
 */
export interface SlowQueryStat {
  query: string;
  calls: number;
  meanMs: number;
  totalMs: number;
}

export interface DatabaseDeepStats {
  tables: TableSizeStat[];
  slowQueries: SlowQueryStat[];
  /** False when `pg_stat_statements` isn't installed — the UI explains rather than showing an empty list. */
  slowQueriesAvailable: boolean;
  /** Null when WAL archiving has never run (mock mode, or a fresh instance). */
  walArchiving: { lastArchivedAt: string | null; failedCount: number } | null;
}

export interface GitRepositorySummary {
  id: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  openPullRequests: number;
  openIssues: number;
  lastCommitSha: string;
  lastCommitMessage: string;
  lastCommitAuthor: string;
  lastCommitAt: string;
  workflowStatus: 'success' | 'failure' | 'running' | 'unknown';
}

export interface FocusSessionState {
  id: string | null;
  type: FocusSessionType;
  status: FocusSessionStatus | 'IDLE';
  durationSec: number;
  elapsedSec: number;
  remainingSec: number;
  sessionIndex: number;
  totalSessions: number;
  label: string | null;
  startedAt: string | null;
}

export interface FocusSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
}

export interface CalendarEventRecord {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  source: string;
}

/** Payload of GET /api/overview — everything the dashboard needs in one call. */
export interface OverviewSnapshot {
  generatedAt: string;
  services: ServiceSummary[];
  system: SystemMetrics;
  projects: ProjectSummary[];
  alerts: AlertRecord[];
  deployments: DeploymentRecord[];
  focus: FocusSessionState;
  events: CalendarEventRecord[];
  self: SelfHealth;
}

/** Observability of the DCC itself (spec §32). */
export interface SelfHealth {
  api: ServiceStatus;
  database: ServiceStatus;
  monitoringEngine: ServiceStatus;
  mockMode: boolean;
  version: string;
  uptimeSec: number;
}
