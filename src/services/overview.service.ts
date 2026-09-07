import 'server-only';
import { monitoringService } from '@/services/monitoring.service';
import { systemService } from '@/services/system.service';
import { projectService, deploymentService } from '@/services/project.service';
import { alertService } from '@/services/alert.service';
import { focusService } from '@/services/focus.service';
import { calendarService } from '@/services/calendar.service';
import { isMockMode } from '@/lib/env';
import { isDatabaseConfigured, pingDatabase } from '@/database/client';
import { getMonitoringEngineState } from '@/services/monitoring.engine';
import { APP_VERSION } from '@/lib/version';
import type { OverviewSnapshot, SelfHealth } from '@/types/domain';

/**
 * One aggregated payload for the dashboard (spec §4).
 *
 * The overview is the only endpoint the main screen polls, so a 30-second
 * refresh costs one request instead of eight — which matters on mobile and on
 * an always-on Echo Show.
 */
export async function buildOverview(userId: string): Promise<OverviewSnapshot> {
  const [services, system, projects, deployments, focus, events] = await Promise.all([
    monitoringService.listServices(),
    systemService.getMetrics(),
    projectService.list(),
    deploymentService.list({ limit: 8 }),
    focusService.getCurrent(userId),
    calendarService.today(userId),
  ]);

  // Rules are evaluated on read so the MVP needs no background scheduler; the
  // alert list is fetched afterwards to include anything this pass produced.
  await alertService.evaluate({ services, system });

  return {
    generatedAt: new Date().toISOString(),
    services,
    system,
    projects,
    alerts: await alertService.listActive(10),
    deployments,
    focus,
    events,
    self: await getSelfHealth(),
  };
}

/** The DCC monitoring itself (spec §32). */
export async function getSelfHealth(): Promise<SelfHealth> {
  const mock = isMockMode();
  const database = mock
    ? 'ONLINE'
    : isDatabaseConfigured() && (await pingDatabase()).ok
      ? 'ONLINE'
      : 'OFFLINE';

  const engine = getMonitoringEngineState();

  return {
    api: 'ONLINE',
    database,
    monitoringEngine: engine.running ? 'ONLINE' : mock ? 'ONLINE' : 'WARNING',
    mockMode: mock,
    version: APP_VERSION,
    uptimeSec: Math.round(process.uptime()),
  };
}
