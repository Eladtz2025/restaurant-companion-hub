import * as Sentry from '@sentry/nextjs';

type TenantContext = {
  tenantId: string;
  role: string;
};

export function setSentryTenantContext({ tenantId, role }: TenantContext): void {
  Sentry.setContext('tenant', { tenant_id: tenantId, role });
  // Never set user.email or identifying fields — tenant_id only
  Sentry.setUser({ id: tenantId });
}
