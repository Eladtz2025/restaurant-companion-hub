import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'restaurant-os',
  eventKey: process.env.INNGEST_EVENT_KEY,
  signingKey: process.env.INNGEST_SIGNING_KEY,
});

// Event type declarations for use across the codebase
export type RestaurantOSEvents = {
  'sync/tenant.requested': { data: { tenantId: string } };
  'echo/test.fired': { data: { message: string; firedAt: string } };
};
