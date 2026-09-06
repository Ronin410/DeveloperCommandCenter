import { describe, expect, it } from 'vitest';
import { buildOverview, getSelfHealth } from '@/services/overview.service';

describe('overview snapshot', () => {
  it('returns every panel the dashboard renders', async () => {
    const snapshot = await buildOverview('usr_mock_admin');

    expect(snapshot.services.length).toBeGreaterThan(0);
    expect(snapshot.projects.length).toBeGreaterThan(0);
    expect(snapshot.deployments.length).toBeGreaterThan(0);
    expect(snapshot.system.cpuPct).toBeGreaterThan(0);
    expect(snapshot.focus.status).toBe('IDLE');
    expect(Array.isArray(snapshot.events)).toBe(true);
    expect(new Date(snapshot.generatedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('reports its own health (spec §32)', async () => {
    const self = await getSelfHealth();

    expect(self.api).toBe('ONLINE');
    expect(self.mockMode).toBe(true);
    expect(self.version).toBeTypeOf('string');
  });

  it('never leaks health-check URLs or secrets to the client payload', async () => {
    const serialized = JSON.stringify(await buildOverview('usr_mock_admin'));
    expect(serialized).not.toMatch(/healthUrl|passwordHash|AUTH_SECRET|tokenHash/);
  });
});
