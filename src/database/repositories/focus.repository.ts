import 'server-only';
import { getPrisma } from '@/database/client';
import type { FocusRepository } from '@/services/ports';
import type { FocusSessionState, FocusSessionStatus, FocusSessionType } from '@/types/domain';

const IDLE: FocusSessionState = {
  id: null,
  type: 'FOCUS',
  status: 'IDLE',
  durationSec: 25 * 60,
  elapsedSec: 0,
  remainingSec: 25 * 60,
  sessionIndex: 1,
  totalSessions: 4,
  label: null,
  startedAt: null,
};

interface FocusRow {
  id: string;
  type: string;
  status: string;
  durationSec: number;
  elapsedSec: number;
  sessionIndex: number;
  totalSessions: number;
  label: string | null;
  startedAt: Date;
  resumedAt: Date | null;
}

/**
 * Elapsed time is derived, never ticked by the server: `elapsedSec` is only
 * written on pause/stop and `resumedAt` anchors the running segment. A timer
 * therefore survives restarts and reconnects without a background job.
 */
function project(row: FocusRow): FocusSessionState {
  const running = row.status === 'RUNNING' && row.resumedAt;
  const elapsed = running
    ? row.elapsedSec + Math.floor((Date.now() - (row.resumedAt as Date).getTime()) / 1000)
    : row.elapsedSec;
  const clamped = Math.min(Math.max(0, elapsed), row.durationSec);
  const completed = clamped >= row.durationSec && row.status === 'RUNNING';

  return {
    id: row.id,
    type: row.type as FocusSessionType,
    status: (completed ? 'COMPLETED' : row.status) as FocusSessionStatus,
    durationSec: row.durationSec,
    elapsedSec: clamped,
    remainingSec: Math.max(0, row.durationSec - clamped),
    sessionIndex: row.sessionIndex,
    totalSessions: row.totalSessions,
    label: row.label,
    startedAt: row.startedAt.toISOString(),
  };
}

export class PrismaFocusRepository implements FocusRepository {
  private async currentRow(userId: string): Promise<FocusRow | null> {
    return getPrisma().focusSession.findFirst({
      where: { userId, status: { in: ['RUNNING', 'PAUSED'] } },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getCurrent(userId: string): Promise<FocusSessionState> {
    const row = await this.currentRow(userId);
    return row ? project(row) : IDLE;
  }

  async start(input: {
    userId: string;
    type: FocusSessionType;
    durationSec: number;
    sessionIndex: number;
    totalSessions: number;
    label: string | null;
  }): Promise<FocusSessionState> {
    const prisma = getPrisma();
    await prisma.focusSession.updateMany({
      where: { userId: input.userId, status: { in: ['RUNNING', 'PAUSED'] } },
      data: { status: 'CANCELLED', finishedAt: new Date() },
    });

    const row = await prisma.focusSession.create({
      data: {
        userId: input.userId,
        type: input.type,
        status: 'RUNNING',
        durationSec: input.durationSec,
        elapsedSec: 0,
        sessionIndex: input.sessionIndex,
        totalSessions: input.totalSessions,
        label: input.label,
        resumedAt: new Date(),
      },
    });
    return project(row);
  }

  async pause(userId: string): Promise<FocusSessionState> {
    const row = await this.currentRow(userId);
    if (!row || row.status !== 'RUNNING') return this.getCurrent(userId);

    const current = project(row);
    const updated = await getPrisma().focusSession.update({
      where: { id: row.id },
      data: { status: 'PAUSED', elapsedSec: current.elapsedSec, resumedAt: null },
    });
    return project(updated);
  }

  async resume(userId: string): Promise<FocusSessionState> {
    const row = await this.currentRow(userId);
    if (!row || row.status !== 'PAUSED') return this.getCurrent(userId);

    const updated = await getPrisma().focusSession.update({
      where: { id: row.id },
      data: { status: 'RUNNING', resumedAt: new Date() },
    });
    return project(updated);
  }

  async stop(userId: string): Promise<FocusSessionState> {
    const row = await this.currentRow(userId);
    if (!row) return IDLE;

    const current = project(row);
    const completed = current.remainingSec === 0;
    const updated = await getPrisma().focusSession.update({
      where: { id: row.id },
      data: {
        status: completed ? 'COMPLETED' : 'CANCELLED',
        elapsedSec: current.elapsedSec,
        resumedAt: null,
        finishedAt: new Date(),
      },
    });
    return project(updated);
  }

  async reset(userId: string): Promise<FocusSessionState> {
    await getPrisma().focusSession.updateMany({
      where: { userId, status: { in: ['RUNNING', 'PAUSED'] } },
      data: { status: 'CANCELLED', finishedAt: new Date() },
    });
    return IDLE;
  }
}
