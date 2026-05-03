import { getAuthContext } from '@/lib/supabase/server';
import { getUserRole, requireTenant } from '@/lib/tenant';

import { DashboardClient } from './_components/DashboardClient';

import type { Role } from '@/lib/permissions';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await requireTenant(tenantSlug);
  const ctx = await getAuthContext();
  const role: Role | null = ctx ? await getUserRole(tenant.id, ctx.userId) : null;

  return (
    <DashboardClient
      tenantId={tenant.id}
      tenantSlug={tenantSlug}
      userRole={role}
      userId={ctx?.userId ?? null}
    />
  );
}
