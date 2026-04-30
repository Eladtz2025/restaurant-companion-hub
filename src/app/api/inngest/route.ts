import { serve } from 'inngest/next';

import { inngest } from '../../../../inngest/client';
import { echoCron } from '../../../../inngest/functions/echo-cron';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [echoCron],
});
