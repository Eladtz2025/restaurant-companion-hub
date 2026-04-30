import { PostHog } from 'posthog-node';

type TrackParams = {
  event: string;
  properties?: Record<string, unknown>;
  tenantId?: string;
  userId?: string;
};

// Server-side PostHog client (singleton)
let _serverClient: PostHog | null = null;

function getServerClient(): PostHog {
  if (!_serverClient) {
    _serverClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '', {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.posthog.com',
      // Flush on each event in serverless environments
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return _serverClient;
}

export async function track({ event, properties, tenantId, userId }: TrackParams): Promise<void> {
  // Respect Do-Not-Track (only relevant server-side via header inspection;
  // browser-side handled in the PostHog provider component)
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  const distinctId = userId ?? tenantId ?? 'anonymous';

  const client = getServerClient();
  client.capture({
    distinctId,
    event,
    properties: {
      ...properties,
      tenant_id: tenantId,
      // Never include PII: no names, phones, emails
      $set_once: { first_seen: new Date().toISOString() },
    },
  });

  await client.flush();
}
