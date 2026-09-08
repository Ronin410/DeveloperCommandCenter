import { ok, route } from '@/lib/api/response';
import { monitoringService } from '@/services/monitoring.service';
import { createServiceSchema, parseQuery, serviceQuerySchema } from '@/lib/api/schemas';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** GET /api/services (spec §26). */
export const GET = route(async ({ request }) => {
  const query = parseQuery(request, serviceQuerySchema);
  return ok(await monitoringService.listServices(query));
});

/**
 * POST /api/services — register a new service to monitor.
 *
 * The graphical alternative to inserting a row by hand: any authenticated
 * user can add one (reversible, not destructive), and it runs an immediate
 * health check so the dashboard shows a real status right away.
 */
export const POST = route(
  async ({ body, session, ip }) => {
    const service = await monitoringService.createService({
      name: body.name,
      description: body.description ?? null,
      kind: body.kind,
      environment: body.environment,
      healthUrl: body.healthUrl,
      projectId: body.projectId ?? null,
    });

    await audit({
      action: 'service.create',
      resource: 'service',
      resourceId: service.id,
      userId: session.user.id,
      ipAddress: ip,
      metadata: { name: service.name, environment: service.environment },
    });

    return ok(service, { status: 201 });
  },
  { schema: createServiceSchema },
);
