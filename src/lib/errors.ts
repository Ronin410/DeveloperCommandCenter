/** Application error carrying an HTTP status and a machine-readable code. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, options: { status?: number; code?: string; details?: unknown } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = options.status ?? 500;
    this.code = options.code ?? 'internal_error';
    this.details = options.details;
  }
}

export const unauthorized = (message = 'Authentication required') =>
  new AppError(message, { status: 401, code: 'unauthorized' });

export const forbidden = (message = 'Insufficient permissions') =>
  new AppError(message, { status: 403, code: 'forbidden' });

export const notFound = (message = 'Resource not found') =>
  new AppError(message, { status: 404, code: 'not_found' });

export const badRequest = (message: string, details?: unknown) =>
  new AppError(message, { status: 400, code: 'bad_request', details });

export const tooManyRequests = (message = 'Too many requests', details?: unknown) =>
  new AppError(message, { status: 429, code: 'rate_limited', details });

export const serviceUnavailable = (message = 'Service unavailable') =>
  new AppError(message, { status: 503, code: 'service_unavailable' });
