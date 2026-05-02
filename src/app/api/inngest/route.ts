import { serve } from 'inngest/next';

import { inngest } from '../../../../inngest/client';
import {
  dailyPrepCron,
  generatePrepForTenant,
} from '../../../../inngest/functions/daily-prep-generator';
import { echoCron } from '../../../../inngest/functions/echo-cron';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [echoCron, generatePrepForTenant, dailyPrepCron],
});
