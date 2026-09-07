/**
 * Minimal structured logger (spec §24 "logging").
 *
 * Deliberately dependency-free: one JSON line per event in production, a
 * readable line in development. Secrets are redacted by key name so an
 * accidental `logger.info('x', { token })` never leaks.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const REDACTED_KEYS = [
  'password',
  'passwordhash',
  'token',
  'tokenhash',
  'secret',
  'authorization',
  'cookie',
  'apikey',
  'api_key',
  'connectionstring',
  'databaseurl',
  'database_url',
  'privatekey',
];

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] = REDACTED_KEYS.includes(key.toLowerCase()) ? '[redacted]' : redact(entry, depth + 1);
  }
  return out;
}

function minLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL as LogLevel | undefined;
  if (configured && configured in LEVEL_ORDER) return configured;
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

function write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel()]) return;

  const payload = {
    level,
    time: new Date().toISOString(),
    msg: message,
    ...(context ? (redact(context) as Record<string, unknown>) : {}),
  };

  const line =
    process.env.NODE_ENV === 'production'
      ? JSON.stringify(payload)
      : `${payload.time} ${level.toUpperCase().padEnd(5)} ${message}${context ? ` ${JSON.stringify(redact(context))}` : ''}`;

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => write('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => write('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => write('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => write('error', message, context),
};
