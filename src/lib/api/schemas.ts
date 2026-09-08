import { z } from 'zod';
import { ENVIRONMENTS, FOCUS_SESSION_TYPES, ALERT_STATUSES, METRIC_TYPES, PROJECT_STATUSES, SERVICE_KINDS } from '@/types/domain';

/** Request validation schemas (spec §39.5 "validar entradas"). */

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  password: z.string().min(1, 'Password is required').max(200),
});

export const serviceQuerySchema = z.object({
  environment: z.enum(ENVIRONMENTS).optional(),
  projectId: z.string().min(1).max(64).optional(),
});

export const alertQuerySchema = z.object({
  status: z.enum(ALERT_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const deploymentQuerySchema = z.object({
  projectId: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const metricQuerySchema = z.object({
  type: z.enum(METRIC_TYPES).default('CPU'),
  limit: z.coerce.number().int().min(1).max(500).default(60),
});

export const dockerLogsQuerySchema = z.object({
  tail: z.coerce.number().int().min(1).max(2000).default(200),
});

export const focusStartSchema = z.object({
  type: z.enum(FOCUS_SESSION_TYPES).default('FOCUS'),
  label: z.string().trim().max(120).nullish(),
  durationSec: z.number().int().min(60).max(4 * 60 * 60).optional(),
});

/**
 * Only http/https are accepted: the server issues a real GET request to this
 * URL on every check cycle, so anything else (file:, data:, …) has no
 * business here.
 */
const httpUrl = z
  .string()
  .trim()
  .max(500)
  .url('A valid URL is required')
  .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'URL must use http or https');

export const createServiceSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().trim().max(500).nullish(),
  kind: z.enum(SERVICE_KINDS).default('API'),
  environment: z.enum(ENVIRONMENTS).default('PRODUCTION'),
  healthUrl: httpUrl,
  projectId: z.string().trim().min(1).max(64).nullish(),
});

/**
 * PATCH /api/services/:id accepts any subset of these fields: pausing/resuming
 * (`isMonitored`) and editing the rest are the same endpoint, since both are
 * reversible, non-destructive changes to an existing service.
 */
export const updateServiceSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    description: z.string().trim().max(500).nullable(),
    kind: z.enum(SERVICE_KINDS),
    environment: z.enum(ENVIRONMENTS),
    healthUrl: httpUrl,
    projectId: z.string().trim().min(1).max(64).nullable(),
    isMonitored: z.boolean(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field is required' });

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().trim().max(500).nullish(),
  repository: z.string().trim().max(200).nullish(),
  environment: z.enum(ENVIRONMENTS).default('DEVELOPMENT'),
  status: z.enum(PROJECT_STATUSES).default('ACTIVE'),
  version: z.string().trim().max(50).nullish(),
});

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    description: z.string().trim().max(500).nullable(),
    repository: z.string().trim().max(200).nullable(),
    environment: z.enum(ENVIRONMENTS),
    status: z.enum(PROJECT_STATUSES),
    version: z.string().trim().max(50).nullable(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field is required' });

/** Parses URL search params with a schema, dropping empty values. */
export function parseQuery<T extends z.ZodType>(request: Request, schema: T): z.infer<T> {
  const url = new URL(request.url);
  const entries = [...url.searchParams.entries()].filter(([, value]) => value !== '');
  return schema.parse(Object.fromEntries(entries));
}
