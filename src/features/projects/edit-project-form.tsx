'use client';

import { useState, type FormEvent } from 'react';
import { ENVIRONMENTS, PROJECT_STATUSES, type ProjectSummary } from '@/types/domain';
import { useSession } from '@/components/layout/session-provider';
import { apiPatch, ApiError } from '@/lib/api/client';
import { Icon } from '@/components/ui/icon';

/**
 * Edits an existing project. Unlike a service's `healthUrl`, none of a
 * project's fields are hidden from the client, so every field can be
 * prefilled with its current value.
 */
export function EditProjectForm({
  project,
  onSaved,
  onClose,
}: {
  project: ProjectSummary;
  onSaved: (project: ProjectSummary) => void;
  onClose: () => void;
}) {
  const { csrfToken } = useSession();
  const [name, setName] = useState(project.name);
  const [repository, setRepository] = useState(project.repository ?? '');
  const [environment, setEnvironment] = useState<(typeof ENVIRONMENTS)[number]>(project.environment);
  const [status, setStatus] = useState<(typeof PROJECT_STATUSES)[number]>(project.status);
  const [version, setVersion] = useState(project.version ?? '');
  const [description, setDescription] = useState(project.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const updated = await apiPatch<ProjectSummary>(
        `/api/projects/${project.id}`,
        {
          name,
          repository: repository || null,
          environment,
          status,
          version: version || null,
          description: description || null,
        },
        csrfToken,
      );
      onSaved(updated);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not update the project');
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mb-4 space-y-4 rounded-xl border border-line bg-surface-raised p-4"
      aria-label="Edit project"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Edit &ldquo;{project.name}&rdquo;</h3>
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

        <Field label="Repository (optional)">
          <input
            value={repository}
            onChange={(event) => setRepository(event.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
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

        <Field label="Status">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          >
            {PROJECT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Version (optional)">
          <input
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
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
