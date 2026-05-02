import { getAuthContext } from '@/lib/supabase/server';
import { getUserRole, requireTenant } from '@/lib/tenant';

import { ChecklistsClient } from './_components/ChecklistsClient';

import type { Role } from '@/lib/permissions';

export default async function ChecklistsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await requireTenant(tenantSlug);
  const ctx = await getAuthContext();
  const role: Role | null = ctx ? await getUserRole(tenant.id, ctx.userId) : null;

  return (
    <ChecklistsClient
      tenantId={tenant.id}
      tenantSlug={tenantSlug}
      userRole={role}
      userId={ctx?.userId ?? null}
    />
  );
}
