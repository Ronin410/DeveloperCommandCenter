'use client';

import { useState, type FormEvent } from 'react';
import { ENVIRONMENTS, SERVICE_KINDS, type ProjectSummary, type ServiceSummary } from '@/types/domain';
import { useSession } from '@/components/layout/session-provider';
import { apiPatch, ApiError } from '@/lib/api/client';
import { Icon } from '@/components/ui/icon';

/**
 * Edits an existing service's fields.
 *
 * `healthUrl` is never sent to the client (it can embed an internal
 * hostname — see SECURITY.md), so this form cannot show the current one.
 * Left blank, the field is simply omitted from the PATCH body and the
 * existing URL is kept; typing a new one re-points the health check and
 * triggers an immediate re-check (server-side, see `MonitoringService.updateService`).
 */
export function EditServiceForm({
  service,
  projects,
  onSaved,
  onClose,
}: {
  service: ServiceSummary;
  projects: ProjectSummary[];
  onSaved: (service: ServiceSummary) => void;
  onClose: () => void;
}) {
  const { csrfToken } = useSession();
  const [name, setName] = useState(service.name);
  const [healthUrl, setHealthUrl] = useState('');
  const [kind, setKind] = useState<(typeof SERVICE_KINDS)[number]>(service.kind);
  const [environment, setEnvironment] = useState<(typeof ENVIRONMENTS)[number]>(service.environment);
  const [projectId, setProjectId] = useState(service.projectId ?? '');
  const [description, setDescription] = useState(service.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const updated = await apiPatch<ServiceSummary>(
        `/api/services/${service.id}`,
        {
          name,
          kind,
          environment,
          projectId: projectId || null,
          description: description || null,
          ...(healthUrl ? { healthUrl } : {}),
        },
        csrfToken,
      );
      onSaved(updated);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not update the service');
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mb-4 space-y-4 rounded-xl border border-line bg-surface-raised p-4"
      aria-label="Edit service"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Edit &ldquo;{service.name}&rdquo;</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-ink-faint transition hover:text-ink"
          aria-label="Close"
        >
          <Icon name="close" className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </Field>

        <Field label="Health check URL">
          <input
            type="url"
            value={healthUrl}
            onChange={(event) => setHealthUrl(event.target.value)}
            placeholder="Leave blank to keep the current URL"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </Field>

        <Field label="Kind">
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          >
            {SERVICE_KINDS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Environment">
          <select
            value={environment}
            onChange={(event) => setEnvironment(event.target.value as typeof environment)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          >
            {ENVIRONMENTS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Project (optional)">
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          >
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Description (optional)">
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </Field>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-offline/40 bg-offline/10 px-3 py-2 text-sm text-offline">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-line px-3 py-2 text-sm text-ink-muted transition hover:border-line-strong hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
