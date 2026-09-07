import 'server-only';
import { getContainer } from '@/services/container';
import type { FocusSessionState, FocusSettings, FocusSessionType } from '@/types/domain';

/**
 * FocusService — Pomodoro (spec §20).
 *
 * The server owns the timer state so the same session is visible from phone,
 * desktop and (later) Alexa; clients only render the remaining seconds.
 */

export const DEFAULT_FOCUS_SETTINGS: FocusSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
};

function durationFor(type: FocusSessionType, settings: FocusSettings): number {
  if (type === 'SHORT_BREAK') return settings.shortBreakMinutes * 60;
  if (type === 'LONG_BREAK') return settings.longBreakMinutes * 60;
  return settings.focusMinutes * 60;
}

export class FocusService {
  private get container() {
    return getContainer();
  }

  constructor(private readonly settings: FocusSettings = DEFAULT_FOCUS_SETTINGS) {}

  getSettings(): FocusSettings {
    return this.settings;
  }

  async getCurrent(userId: string): Promise<FocusSessionState> {
    return this.container.focus.getCurrent(userId);
  }

  async start(
    userId: string,
    options: { type?: FocusSessionType; label?: string | null; durationSec?: number } = {},
  ): Promise<FocusSessionState> {
    const type = options.type ?? 'FOCUS';
    const current = await this.getCurrent(userId);
    const sessionIndex =
      type === 'FOCUS' && current.status === 'COMPLETED'
        ? (current.sessionIndex % this.settings.sessionsBeforeLongBreak) + 1
        : current.status === 'IDLE'
          ? 1
          : current.sessionIndex;

    return this.container.focus.start({
      userId,
      type,
      durationSec: options.durationSec ?? durationFor(type, this.settings),
      sessionIndex,
      totalSessions: this.settings.sessionsBeforeLongBreak,
      label: options.label ?? null,
    });
  }

  async pause(userId: string): Promise<FocusSessionState> {
    return this.container.focus.pause(userId);
  }

  async resume(userId: string): Promise<FocusSessionState> {
    return this.container.focus.resume(userId);
  }

  async stop(userId: string): Promise<FocusSessionState> {
    return this.container.focus.stop(userId);
  }

  async reset(userId: string): Promise<FocusSessionState> {
    return this.container.focus.reset(userId);
  }
}

export const focusService = new FocusService();
