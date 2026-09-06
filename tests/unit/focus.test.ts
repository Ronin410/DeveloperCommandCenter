import { describe, expect, it, vi, afterEach } from 'vitest';
import { FocusService } from '@/services/focus.service';

const USER = 'usr_test';

afterEach(() => {
  vi.useRealTimers();
});

describe('focus service', () => {
  it('starts idle with the configured duration', async () => {
    const focus = new FocusService();
    const state = await focus.getCurrent(USER);

    expect(state.status).toBe('IDLE');
    expect(state.remainingSec).toBe(25 * 60);
  });

  it('counts down while running', async () => {
    vi.useFakeTimers();
    const focus = new FocusService();
    await focus.start(USER);

    vi.advanceTimersByTime(60_000);
    const state = await focus.getCurrent(USER);

    expect(state.status).toBe('RUNNING');
    expect(state.elapsedSec).toBe(60);
    expect(state.remainingSec).toBe(24 * 60);
  });

  it('freezes elapsed time while paused and continues on resume', async () => {
    vi.useFakeTimers();
    const focus = new FocusService();
    await focus.start(USER);

    vi.advanceTimersByTime(30_000);
    const paused = await focus.pause(USER);
    expect(paused.status).toBe('PAUSED');
    expect(paused.elapsedSec).toBe(30);

    vi.advanceTimersByTime(120_000);
    expect((await focus.getCurrent(USER)).elapsedSec).toBe(30);

    await focus.resume(USER);
    vi.advanceTimersByTime(10_000);
    expect((await focus.getCurrent(USER)).elapsedSec).toBe(40);
  });

  it('completes once the duration elapses and never goes negative', async () => {
    vi.useFakeTimers();
    const focus = new FocusService();
    await focus.start(USER);

    vi.advanceTimersByTime(26 * 60 * 1000);
    const state = await focus.getCurrent(USER);

    expect(state.status).toBe('COMPLETED');
    expect(state.remainingSec).toBe(0);
    expect(state.elapsedSec).toBe(25 * 60);
  });

  it('uses break durations for break sessions', async () => {
    const focus = new FocusService();
    expect((await focus.start(USER, { type: 'SHORT_BREAK' })).durationSec).toBe(5 * 60);
    expect((await focus.start(USER, { type: 'LONG_BREAK' })).durationSec).toBe(15 * 60);
  });

  it('resets back to idle', async () => {
    const focus = new FocusService();
    await focus.start(USER);
    expect((await focus.reset(USER)).status).toBe('IDLE');
  });
});
