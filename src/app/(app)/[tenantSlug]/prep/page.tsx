import { getAuthContext } from '@/lib/supabase/server';
import { getUserRole, requireTenant } from '@/lib/tenant';

import { PrepListClient } from './_components/PrepListClient';

import type { Role } from '@/lib/permissions';

export default async function PrepPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const tenant = await requireTenant(tenantSlug);
  const ctx = await getAuthContext();
  const role: Role | null = ctx ? await getUserRole(tenant.id, ctx.userId) : null;

  return <PrepListClient tenantId={tenant.id} tenantSlug={tenantSlug} userRole={role} />;
}
