'use client';

import Link from 'next/link';
import { Card, EmptyState } from '@/components/ui/card';
import { Meter } from '@/components/ui/meter';
import { StatusDot, StatusPill, statusColorClass } from '@/components/ui/status';
import { Icon } from '@/components/ui/icon';
import {
  cn,
  formatClock,
  formatLatency,
  formatPercent,
  formatRelativeTime,
  formatTime,
  formatUptime,
} from '@/utils/format';
import type {
  AlertRecord,
  AlertSeverity,
  CalendarEventRecord,
  DeploymentRecord,
  DeploymentStatus,
  FocusSessionState,
  ProjectSummary,
  SelfHealth,
  ServiceSummary,
  SystemMetrics,
} from '@/types/domain';

/** Reusable dashboard panels, shared by the overview and the kiosk view. */

export function ServicesPanel({ services }: { services: ServiceSummary[] }) {
  return (
    <Card title="Services" subtitle={`${services.filter((s) => s.status === 'ONLINE').length}/${services.length} online`} flush>
      <ul className="divide-y divide-line">
        {services.map((service) => (
          <li key={service.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <Link href={`/infrastructure#${service.slug}`} className="flex min-w-0 items-center gap-3">
              <StatusDot status={service.status} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{service.name}</span>
                <span className="block truncate text-xs text-ink-faint">{service.environment}</span>
              </span>
            </Link>
            <span className="flex items-center gap-3 text-right">
              <span className={cn('text-xs font-medium', statusColorClass(service.status))}>{service.status}</span>
              <span className="tabular w-20 text-sm text-ink-muted">{formatLatency(service.latencyMs)}</span>
            </span>
          </li>
        ))}
        {services.length === 0 && <EmptyState message="No services registered yet." />}
      </ul>
    </Card>
  );
}

export function SystemPanel({ system }: { system: SystemMetrics }) {
  return (
    <Card title="System" subtitle={`Uptime ${formatUptime(system.uptimeSec)}`}>
      <div className="space-y-4">
        <Meter label="CPU" value={system.cpuPct} />
        <Meter label="RAM" value={system.ramPct} />
        <Meter label="Disk" value={system.diskPct} />
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-center">
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wider text-ink-faint">Requests</dt>
          <dd className="tabular mt-1 text-sm text-ink">{system.requestsPerMin}/min</dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wider text-ink-faint">Errors</dt>
          <dd className={cn('tabular mt-1 text-sm', system.errorRatePct > 1 ? 'text-warning' : 'text-ink')}>
            {formatPercent(system.errorRatePct, 2)}
          </dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wider text-ink-faint">Latency</dt>
          <dd className="tabular mt-1 text-sm text-ink">{formatLatency(system.avgLatencyMs)}</dd>
        </div>
      </dl>
    </Card>
  );
}

const PROJECT_ENV_TONE: Record<string, string> = {
  PRODUCTION: 'text-online',
  STAGING: 'text-warning',
  DEVELOPMENT: 'text-info',
};

export function ProjectsPanel({ projects }: { projects: ProjectSummary[] }) {
  return (
    <Card title="Projects" subtitle={`${projects.length} tracked`} flush>
      <ul className="divide-y divide-line">
        {projects.map((project) => (
          <li key={project.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">{project.name}</span>
              <span className="block truncate text-xs text-ink-faint">
                {project.healthyServices}/{project.serviceCount} services healthy
              </span>
            </span>
            <span className={cn('shrink-0 text-xs font-medium', PROJECT_ENV_TONE[project.environment] ?? 'text-ink-muted')}>
              {project.environment}
            </span>
          </li>
        ))}
        {projects.length === 0 && <EmptyState message="No projects yet." />}
      </ul>
    </Card>
  );
}

export const SEVERITY_TONE: Record<AlertSeverity, string> = {
  INFO: 'text-info',
  WARNING: 'text-warning',
  ERROR: 'text-offline',
  CRITICAL: 'text-offline',
};

export function AlertsPanel({
  alerts,
  onAcknowledge,
  onResolve,
  busyId,
}: {
  alerts: AlertRecord[];
  onAcknowledge?: (id: string) => void;
  onResolve?: (id: string) => void;
  busyId?: string | null;
}) {
  return (
    <Card title="Alerts" subtitle={alerts.length === 0 ? 'All clear' : `${alerts.length} open`} flush>
      <ul className="divide-y divide-line">
        {alerts.map((alert) => (
          <li key={alert.id} className="px-4 py-3">
            <div className="flex items-start gap-3">
              <Icon name="alert" className={cn('mt-0.5 size-4 shrink-0', SEVERITY_TONE[alert.severity])} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{alert.title}</p>
                <p className="mt-0.5 text-xs text-ink-faint">
                  {alert.serviceName ? `${alert.serviceName} · ` : ''}
                  {formatRelativeTime(alert.createdAt)}
                  {alert.occurrences > 1 ? ` · ×${alert.occurrences}` : ''}
                  {alert.status === 'ACKNOWLEDGED' ? ' · acknowledged' : ''}
                </p>
              </div>

              {(onAcknowledge || onResolve) && (
                <div className="flex shrink-0 gap-1.5">
                  {onAcknowledge && alert.status === 'ACTIVE' && (
                    <button
                      type="button"
                      onClick={() => onAcknowledge(alert.id)}
                      disabled={busyId === alert.id}
                      className="rounded-md border border-line px-2 py-1 text-[0.65rem] uppercase tracking-wider text-ink-muted transition hover:border-warning hover:text-warning disabled:opacity-50"
                    >
                      Ack
                    </button>
                  )}
                  {onResolve && (
                    <button
                      type="button"
                      onClick={() => onResolve(alert.id)}
                      disabled={busyId === alert.id}
                      className="rounded-md border border-line px-2 py-1 text-[0.65rem] uppercase tracking-wider text-ink-muted transition hover:border-online hover:text-online disabled:opacity-50"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
        {alerts.length === 0 && <EmptyState message="No active alerts." />}
      </ul>
    </Card>
  );
}

export const DEPLOYMENT_TONE: Record<DeploymentStatus, string> = {
  SUCCESS: 'text-online',
  RUNNING: 'text-info',
  FAILED: 'text-offline',
  CANCELLED: 'text-unknown',
};

export function DeploymentsPanel({ deployments }: { deployments: DeploymentRecord[] }) {
  return (
    <Card title="Deployments" subtitle="Latest activity" flush>
      <ul className="divide-y divide-line">
        {deployments.map((deployment) => (
          <li key={deployment.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">
                {deployment.projectName} <span className="text-ink-faint">{deployment.version}</span>
              </span>
              <span className="block truncate text-xs text-ink-faint">
                {deployment.environment} · {deployment.branch} · {deployment.commitSha.slice(0, 7)} ·{' '}
                {formatRelativeTime(deployment.startedAt)}
              </span>
            </span>
            <span className={cn('shrink-0 text-xs font-medium', DEPLOYMENT_TONE[deployment.status])}>
              {deployment.status}
            </span>
          </li>
        ))}
        {deployments.length === 0 && <EmptyState message="No deployments recorded." />}
      </ul>
    </Card>
  );
}

export function FocusPanel({
  focus,
  onAction,
  pending,
  compact,
}: {
  focus: FocusSessionState;
  onAction?: (action: 'start' | 'pause' | 'resume' | 'stop' | 'reset') => void;
  pending?: boolean;
  compact?: boolean;
}) {
  const progress = focus.durationSec > 0 ? (focus.elapsedSec / focus.durationSec) * 100 : 0;
  const running = focus.status === 'RUNNING';

  return (
    <Card title="Focus" subtitle={`Session ${focus.sessionIndex} / ${focus.totalSessions}`}>
      <p className={cn('tabular text-center font-semibold tracking-tight text-ink', compact ? 'text-5xl' : 'text-4xl')}>
        {formatClock(focus.remainingSec)}
      </p>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-700"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>

      <p className="mt-2 text-center text-xs uppercase tracking-wider text-ink-faint">
        {focus.status === 'IDLE' ? 'Ready' : `${focus.type.replace('_', ' ')} · ${focus.status}`}
      </p>

      {onAction && (
        <div className="mt-4 flex justify-center gap-2">
          {running ? (
            <ControlButton icon="pause" label="Pause" onClick={() => onAction('pause')} disabled={pending} />
          ) : focus.status === 'PAUSED' ? (
            <ControlButton icon="play" label="Resume" onClick={() => onAction('resume')} disabled={pending} />
          ) : (
            <ControlButton icon="play" label="Start" onClick={() => onAction('start')} disabled={pending} primary />
          )}
          <ControlButton icon="stop" label="Stop" onClick={() => onAction('stop')} disabled={pending || focus.status === 'IDLE'} />
          <ControlButton icon="refresh" label="Reset" onClick={() => onAction('reset')} disabled={pending} />
        </div>
      )}
    </Card>
  );
}

function ControlButton({
  icon,
  label,
  onClick,
  disabled,
  primary,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40',
        primary
          ? 'border-accent bg-accent/10 text-accent hover:bg-accent/20'
          : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
      )}
    >
      <Icon name={icon} className="size-3.5" />
      {label}
    </button>
  );
}

export function CalendarPanel({ events }: { events: CalendarEventRecord[] }) {
  return (
    <Card title="Today" subtitle={`${events.length} event${events.length === 1 ? '' : 's'}`} flush>
      <ul className="divide-y divide-line">
        {events.map((event) => (
          <li key={event.id} className="flex items-baseline gap-4 px-4 py-2.5">
            <span className="tabular w-12 shrink-0 text-sm text-accent">{formatTime(event.startsAt)}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm text-ink">{event.title}</span>
              {event.description && <span className="block truncate text-xs text-ink-faint">{event.description}</span>}
            </span>
          </li>
        ))}
        {events.length === 0 && <EmptyState message="Nothing scheduled today." />}
      </ul>
    </Card>
  );
}

/** Self-observability strip (spec §32). */
export function SelfHealthPanel({ self }: { self: SelfHealth }) {
  const rows: [string, SelfHealth['api']][] = [
    ['DCC API', self.api],
    ['Database', self.database],
    ['Monitoring Engine', self.monitoringEngine],
  ];

  return (
    <Card title="Command Center" subtitle={`v${self.version}${self.mockMode ? ' · mock mode' : ''}`} flush>
      <ul className="divide-y divide-line">
        {rows.map(([label, status]) => (
          <li key={label} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-ink-muted">{label}</span>
            <StatusPill status={status} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
