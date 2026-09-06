import { describe, expect, it } from 'vitest';
import { cn, formatClock, formatLatency, formatPercent, formatUptime } from '@/utils/format';

describe('formatting helpers', () => {
  it('formats latency in ms and s', () => {
    expect(formatLatency(128)).toBe('128 ms');
    expect(formatLatency(2500)).toBe('2.50 s');
    expect(formatLatency(null)).toBe('—');
  });

  it('formats percentages', () => {
    expect(formatPercent(61)).toBe('61%');
    expect(formatPercent(0.4, 2)).toBe('0.40%');
    expect(formatPercent(null)).toBe('—');
  });

  it('formats uptime', () => {
    expect(formatUptime(90)).toBe('1m');
    expect(formatUptime(3660)).toBe('1h 1m');
    expect(formatUptime(90000)).toBe('1d 1h');
    expect(formatUptime(0)).toBe('—');
  });

  it('formats a pomodoro clock', () => {
    expect(formatClock(1477)).toBe('24:37');
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(-5)).toBe('00:00');
  });

  it('joins class names, skipping falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });
});
