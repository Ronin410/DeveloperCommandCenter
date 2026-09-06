import { z } from 'zod';
import { ENVIRONMENTS, FOCUS_SESSION_TYPES, ALERT_STATUSES, METRIC_TYPES } from '@/types/domain';

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

export const focusStartSchema = z.object({
  type: z.enum(FOCUS_SESSION_TYPES).default('FOCUS'),
  label: z.string().trim().max(120).nullish(),
  durationSec: z.number().int().min(60).max(4 * 60 * 60).optional(),
});

/** Parses URL search params with a schema, dropping empty values. */
export function parseQuery<T extends z.ZodType>(request: Request, schema: T): z.infer<T> {
  const url = new URL(request.url);
  const entries = [...url.searchParams.entries()].filter(([, value]) => value !== '');
  return schema.parse(Object.fromEntries(entries));
}
