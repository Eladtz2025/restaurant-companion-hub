import { NextResponse } from 'next/server';

import { inngest } from '../../../../inngest/client';

export async function POST(): Promise<NextResponse> {
  if (process.env.NEXT_PUBLIC_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const result = await inngest.send({
    name: 'echo/test.fired',
    data: { message: 'manual test', firedAt: new Date().toISOString() },
  });

  return NextResponse.json({ ok: true, ids: result.ids });
}
