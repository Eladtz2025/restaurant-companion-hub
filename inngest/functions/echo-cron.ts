import { logger } from '@/lib/observability';

import { inngest } from '../client';

// Production: daily 04:00 IST = 01:00 UTC. Dev: every 5 minutes.
const cron = process.env.NEXT_PUBLIC_ENV === 'production' ? '0 1 * * *' : '*/5 * * * *';

export const echoCron = inngest.createFunction(
  {
    id: 'echo-cron',
    retries: 2,
    triggers: [{ cron }],
  },
  async ({ step }) => {
    await step.run('log-fire', () => {
      logger.info({ action: 'echo.fired', timestamp: new Date().toISOString() });
    });

    const firedAt = new Date().toISOString();

    await step.run('send-event', async () => {
      await inngest.send({
        name: 'echo/test.fired',
        data: { message: 'echo cron fired', firedAt },
      });
    });

    return { ok: true, firedAt };
  },
);
