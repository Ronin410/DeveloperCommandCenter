import type {
  AlertRecord,
  AlertSeverity,
  AlertStatus,
  AlertType,
  CalendarEventRecord,
  DatabaseStats,
  DeploymentRecord,
  DockerContainer,
  FocusSessionState,
  GitRepositorySummary,
  MetricType,
  ProjectSummary,
  ServiceCheckRecord,
  ServiceDetail,
  ServiceStatus,
  ServiceSummary,
  SystemMetrics,
} from '@/types/domain';

/**
 * Ports (hexagonal boundaries) used by the service layer.
 *
 * Every port has a mock adapter and — where the MVP needs it — a database or
 * real-provider adapter. Business logic depends only on these interfaces, which
 * is what makes MOCK_MODE a configuration switch instead of a code branch
 * scattered across the app (spec §3, §33).
 */

export interface ServiceRepository {
  list(filter?: { environment?: string; projectId?: string }): Promise<ServiceSummary[]>;
  findBySlugOrId(idOrSlug: string): Promise<ServiceDetail | null>;
  recordCheck(input: {
    serviceId: string;
    status: ServiceStatus;
    responseTime: number | null;
    httpStatus: number | null;
    error: string | null;
  }): Promise<ServiceCheckRecord>;
  listChecks(serviceId: string, limit: number): Promise<ServiceCheckRecord[]>;
  /** Health-check targets for the monitoring engine. */
  listMonitored(): Promise<{ id: string; slug: string; name: string; healthUrl: string | null }[]>;
}

export interface MetricRepository {
  record(input: { serviceId?: string | null; type: MetricType; value: number; unit?: string }): Promise<void>;
  history(input: { type: MetricType; serviceId?: string | null; limit: number }): Promise<
    { value: number; timestamp: string }[]
  >;
}

export interface ProjectRepository {
  list(): Promise<ProjectSummary[]>;
  findBySlugOrId(idOrSlug: string): Promise<ProjectSummary | null>;
}

export interface DeploymentRepository {
  list(filter?: { projectId?: string; limit?: number }): Promise<DeploymentRecord[]>;
}

export interface AlertRepository {
  list(filter?: { status?: AlertStatus; limit?: number }): Promise<AlertRecord[]>;
  findById(id: string): Promise<AlertRecord | null>;
  findActiveByFingerprint(fingerprint: string): Promise<AlertRecord | null>;
  create(input: {
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    description: string | null;
    serviceId: string | null;
    serviceName: string | null;
    fingerprint: string;
  }): Promise<AlertRecord>;
  incrementOccurrence(id: string): Promise<AlertRecord>;
  updateStatus(id: string, status: AlertStatus): Promise<AlertRecord>;
}

export interface FocusRepository {
  getCurrent(userId: string): Promise<FocusSessionState>;
  start(input: {
    userId: string;
    type: FocusSessionState['type'];
    durationSec: number;
    sessionIndex: number;
    totalSessions: number;
    label: string | null;
  }): Promise<FocusSessionState>;
  pause(userId: string): Promise<FocusSessionState>;
  resume(userId: string): Promise<FocusSessionState>;
  stop(userId: string): Promise<FocusSessionState>;
  reset(userId: string): Promise<FocusSessionState>;
}

export interface CalendarRepository {
  listForDay(userId: string, day: Date): Promise<CalendarEventRecord[]>;
  listUpcoming(userId: string, limit: number): Promise<CalendarEventRecord[]>;
}

export interface SystemMetricsProvider {
  read(): Promise<SystemMetrics>;
}

export interface DockerProvider {
  listContainers(): Promise<DockerContainer[]>;
  isAvailable(): Promise<boolean>;
}

export interface DatabaseStatsProvider {
  read(): Promise<DatabaseStats>;
}

export interface GitProvider {
  listRepositories(): Promise<GitRepositorySummary[]>;
}
