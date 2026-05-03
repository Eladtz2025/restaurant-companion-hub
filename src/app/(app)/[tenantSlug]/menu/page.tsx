import { getMenuItems } from '@/lib/actions/menu-items';
import { getAuthContext } from '@/lib/supabase/server';
import { getUserRole, requireTenant } from '@/lib/tenant';

import { MenuClient } from './_components/MenuClient';

import type { Role } from '@/lib/permissions';

export default async function MenuPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const tenant = await requireTenant(tenantSlug);
  const ctx = await getAuthContext();
  const role: Role | null = ctx ? await getUserRole(tenant.id, ctx.userId) : null;

  let initialItems: Awaited<ReturnType<typeof getMenuItems>> = [];
  let loadError: string | null = null;
  try {
    initialItems = await getMenuItems(tenant.id);
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'unknown';
  }

  return (
    <MenuClient
      tenantId={tenant.id}
      tenantSlug={tenantSlug}
      userRole={role}
      initialItems={initialItems}
      initialError={loadError}
    />
  );
}
