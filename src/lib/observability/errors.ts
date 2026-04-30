import * as Sentry from '@sentry/nextjs';

import { logger } from './logger';
import { track } from './posthog';

type ErrorContext = {
  tenantId?: string;
  userId?: string;
  action?: string;
  [key: string]: unknown;
};

export async function reportError(err: unknown, context: ErrorContext = {}): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);

  // Sentry
  Sentry.captureException(err, { extra: { ...context, user_id: context.userId } });

  // Axiom
  logger.error({ action: context.action ?? 'error_occurred', error: message, ...context });

  // PostHog
  await track({
    event: 'error_occurred',
    properties: { error_message: message, action: context.action },
    tenantId: context.tenantId,
    userId: context.userId,
  });
}
