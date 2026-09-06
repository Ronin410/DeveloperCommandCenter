import type { Metadata } from 'next';
import { requirePageSession } from '@/lib/auth/page-guard';
import { monitoringService } from '@/services/monitoring.service';
import { dockerService } from '@/services/docker.service';
import { databaseService } from '@/services/database.service';
import { InfrastructureView } from '@/features/infrastructure/infrastructure-view';

export const metadata: Metadata = { title: 'Infrastructure' };
export const dynamic = 'force-dynamic';

export default async function InfrastructurePage() {
  await requirePageSession('/infrastructure');

  const [services, docker, database] = await Promise.all([
    monitoringService.listServices(),
    dockerService.listContainers(),
    databaseService.getStats(),
  ]);

  return <InfrastructureView initial={{ services, docker, database }} />;
}
