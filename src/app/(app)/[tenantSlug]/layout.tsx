import { redirect } from 'next/navigation';

import { AppShell } from '@/components/shared/AppShell';
import { TenantProvider } from '@/contexts/TenantContext';
import { getAuthContext } from '@/lib/supabase/server';
import { getUserRole, requireTenant } from '@/lib/tenant';

import type { Role } from '@/lib/permissions';

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
};

export default async function TenantLayout({ children, params }: LayoutProps) {
  const { tenantSlug } = await params;
  const tenant = await requireTenant(tenantSlug);

  const ctx = await getAuthContext();
  if (!ctx) redirect('/login');

  const userRole = await getUserRole(tenant.id, ctx.userId);
  if (!userRole) redirect('/login');

  return (
    <TenantProvider
      value={{
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        userRole: userRole as Role,
        userId: ctx.userId,
      }}
    >
      <AppShell tenantSlug={tenant.slug} userRole={userRole as Role}>
        {children}
      </AppShell>
    </TenantProvider>
  );
}
