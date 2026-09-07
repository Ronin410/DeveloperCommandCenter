import 'server-only';
import { logger } from '@/lib/logger';
import type { AlertSeverity } from '@/types/domain';

/**
 * NotificationService (spec §16).
 *
 * The abstraction ships in the MVP; the providers do not. Only the log
 * provider is registered today, so alerting has a working seam without
 * pretending to deliver email or Telegram messages that nobody configured.
 */

export interface NotificationPayload {
  title: string;
  body: string;
  severity: AlertSeverity;
  alertId?: string;
}

export interface NotificationProvider {
  readonly channel: 'PUSH' | 'EMAIL' | 'TELEGRAM' | 'DISCORD' | 'ALEXA' | 'LOG';
  isEnabled(): boolean;
  send(payload: NotificationPayload): Promise<void>;
}

class LogNotificationProvider implements NotificationProvider {
  readonly channel = 'LOG' as const;

  isEnabled(): boolean {
    return true;
  }

  async send(payload: NotificationPayload): Promise<void> {
    logger.info('notification', { channel: this.channel, severity: payload.severity, title: payload.title });
  }
}

export class NotificationService {
  private readonly providers: NotificationProvider[] = [new LogNotificationProvider()];

  register(provider: NotificationProvider): void {
    this.providers.push(provider);
  }

  /** Fan-out to every enabled provider; one failure never blocks the others. */
  async dispatch(payload: NotificationPayload): Promise<void> {
    await Promise.all(
      this.providers
        .filter((provider) => provider.isEnabled())
        .map(async (provider) => {
          try {
            await provider.send(payload);
          } catch (error) {
            logger.error('Notification provider failed', {
              channel: provider.channel,
              error: (error as Error).message,
            });
          }
        }),
    );
  }
}

export const notificationService = new NotificationService();
