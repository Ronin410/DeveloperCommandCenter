import { describe, expect, it } from 'vitest';
import { projectService } from '@/services/project.service';
import { monitoringService } from '@/services/monitoring.service';

/** Graphical project management (spec §9, §26) — create/edit/remove, same discipline as services. */
describe('graphical project management (mock mode)', () => {
  it('creates a project and it appears in the list', async () => {
    const created = await projectService.create({
      name: 'My Custom Project',
      description: 'A project I care about',
      repository: 'github.com/me/my-project',
      environment: 'PRODUCTION',
      status: 'ACTIVE',
      version: 'v0.1.0',
    });

    expect(created.slug).toBe('my-custom-project');
    expect(created.serviceCount).toBe(0);

    const projects = await projectService.list();
    expect(projects.some((project) => project.id === created.id)).toBe(true);
  });

  it('assigns a unique slug when two projects share a name', async () => {
    const first = await projectService.create({
      name: 'Duplicate Project',
      description: null,
      repository: null,
      environment: 'DEVELOPMENT',
      status: 'ACTIVE',
      version: null,
    });
    const second = await projectService.create({
      name: 'Duplicate Project',
      description: null,
      repository: null,
      environment: 'DEVELOPMENT',
      status: 'ACTIVE',
      version: null,
    });

    expect(first.slug).toBe('duplicate-project');
    expect(second.slug).toBe('duplicate-project-2');
  });

  it('edits a custom project and regenerates its slug when the name changes', async () => {
    const created = await projectService.create({
      name: 'Editable Project',
      description: null,
      repository: null,
      environment: 'DEVELOPMENT',
      status: 'ACTIVE',
      version: null,
    });

    const updated = await projectService.update(created.id, { name: 'Renamed Project', status: 'PAUSED' });

    expect(updated.name).toBe('Renamed Project');
    expect(updated.slug).toBe('renamed-project');
    expect(updated.status).toBe('PAUSED');
  });

  it('refuses to edit a built-in demo project', async () => {
    const projects = await projectService.list();
    const builtIn = projects[0]!;

    await expect(projectService.update(builtIn.id, { name: 'Hacked' })).rejects.toMatchObject({ status: 400 });
  });

  it('removes a custom project and unlinks (does not delete) its services', async () => {
    const project = await projectService.create({
      name: 'Disposable Project',
      description: null,
      repository: null,
      environment: 'DEVELOPMENT',
      status: 'ACTIVE',
      version: null,
    });

    const service = await monitoringService.createService({
      name: 'Service In Disposable Project',
      description: null,
      kind: 'API',
      environment: 'DEVELOPMENT',
      healthUrl: 'http://127.0.0.1:1/health',
      projectId: project.id,
    });
    expect(service.projectId).toBe(project.id);

    await projectService.remove(project.id);

    const projects = await projectService.list();
    expect(projects.some((item) => item.id === project.id)).toBe(false);

    const stillThere = await monitoringService.getService(service.id);
    expect(stillThere.projectId).toBeNull();
  });

  it('refuses to remove a built-in demo project', async () => {
    const projects = await projectService.list();
    const builtIn = projects[0]!;

    await expect(projectService.remove(builtIn.id)).rejects.toMatchObject({ status: 400 });

    const stillThere = await projectService.list();
    expect(stillThere.some((project) => project.id === builtIn.id)).toBe(true);
  });
});
