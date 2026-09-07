import { NextResponse } from 'next/server';
import { getSelfHealth } from '@/services/overview.service';
import { APP_VERSION } from '@/lib/version';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health — public liveness/readiness probe (spec §7).
 *
 * Intentionally unauthenticated and intentionally sparse: load balancers and
 * uptime monitors need it, so it must never leak internal topology.
 */
export async function GET(): Promise<Response> {
  const self = await getSelfHealth();
  const healthy = self.api === 'ONLINE' && self.database !== 'OFFLINE';

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      version: APP_VERSION,
      uptime: self.uptimeSec,
    },
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
