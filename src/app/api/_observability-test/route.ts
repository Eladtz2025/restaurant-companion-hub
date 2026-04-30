import { NextResponse } from 'next/server';

import { reportError, logger, track } from '@/lib/observability';

export async function GET(): Promise<NextResponse> {
  if (process.env.NEXT_PUBLIC_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  try {
    // Log to Axiom
    logger.info({ action: 'observability_test.triggered' });

    // Track to PostHog
    await track({ event: 'page_viewed', properties: { page: '_observability-test' } });

    // Throw so Sentry captures it
    throw new Error('Observability test error — intentional');
  } catch (err) {
    await reportError(err, { action: 'observability_test' });
    return NextResponse.json({ ok: true, message: 'Error reported to Sentry, log + event sent' });
  }
}
