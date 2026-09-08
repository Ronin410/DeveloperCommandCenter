'use client';

import { useState, type FormEvent } from 'react';
import { ENVIRONMENTS, SERVICE_KINDS, type ProjectSummary, type ServiceSummary } from '@/types/domain';
import { useSession } from '@/components/layout/session-provider';
import { apiPost, ApiError } from '@/lib/api/client';
import { Icon } from '@/components/ui/icon';

/**
 * Graphical alternative to inserting a row by hand (spec §26).
 *
 * Only Name and Health check URL are required; the slug, status and history
 * are all derived server-side. Submitting runs one check immediately, so the
 * new service shows a real status instead of "UNKNOWN" until the next cycle.
 */
export function AddServiceForm({
  projects,
  onCreated,
  onClose,
}: {
  projects: ProjectSummary[];
  onCreated: (service: ServiceSummary) => void;
  onClose: () => void;
}) {
  const { csrfToken } = useSession();
  const [name, setName] = useState('');
  const [healthUrl, setHealthUrl] = useState('https://');
  const [kind, setKind] = useState<(typeof SERVICE_KINDS)[number]>('API');
  const [environment, setEnvironment] = useState<(typeof ENVIRONMENTS)[number]>('PRODUCTION');
  const [projectId, setProjectId] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const service = await apiPost<ServiceSummary>(
        '/api/services',
        {
          name,
          healthUrl,
          kind,
          environment,
          projectId: projectId || null,
          description: description || null,
        },
        csrfToken,
      );
      onCreated(service);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not create the service');
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mb-4 space-y-4 rounded-xl border border-line bg-surface-raised p-4"
      aria-label="Add service to monitor"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Add a service to monitor</h3>
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
            placeholder="My API"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </Field>

        <Field label="Health check URL">
          <input
            required
            type="url"
            value={healthUrl}
            onChange={(event) => setHealthUrl(event.target.value)}
            placeholder="https://api.example.com/health"
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
            placeholder="What this service does"
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
          {pending ? 'Adding…' : 'Add service'}
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
