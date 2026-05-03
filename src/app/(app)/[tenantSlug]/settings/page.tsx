import { Bell, ChevronLeft, Shield, Users } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getAuthContext, createServerSupabaseClient } from '@/lib/supabase/server';
import { getUserRole, requireTenant } from '@/lib/tenant';

import { TenantSettingsForm } from './_components/TenantSettingsForm';

type PageProps = { params: Promise<{ tenantSlug: string }> };

export default async function SettingsPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const tenant = await requireTenant(tenantSlug);
  const ctx = await getAuthContext();
  if (!ctx) redirect('/login');

  const userRole = await getUserRole(tenant.id, ctx.userId);
  const canEdit = userRole === 'owner' || userRole === 'manager';

  const supabase = await createServerSupabaseClient();
  const { count } = await supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id);

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-2 py-6">
      <h1 className="text-2xl font-bold">הגדרות</h1>

      <section className="bg-card rounded-xl border p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold">פרטי המסעדה</h2>
        <TenantSettingsForm tenantId={tenant.id} initialName={tenant.name} canEdit={canEdit} />
        <p className="text-muted-foreground mt-3 text-xs">
          מזהה:{' '}
          <span dir="ltr" className="font-mono">
            {tenant.slug}
          </span>
        </p>
      </section>

      <section className="bg-card rounded-xl border shadow-sm">
        <h2 className="border-b px-6 py-4 text-base font-semibold">ניהול</h2>

        <Link
          href={`/${tenantSlug}/settings/team`}
          className="hover:bg-accent flex items-center justify-between px-6 py-4 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Users className="text-muted-foreground h-5 w-5" />
            <div>
              <p className="text-sm font-medium">ניהול צוות</p>
              <p className="text-muted-foreground text-xs">{count ?? 0} חברי צוות</p>
            </div>
          </div>
          <ChevronLeft className="text-muted-foreground h-4 w-4" />
        </Link>

        <div className="flex items-center justify-between border-t px-6 py-4 opacity-40">
          <div className="flex items-center gap-3">
            <Bell className="text-muted-foreground h-5 w-5" />
            <div>
              <p className="text-sm font-medium">התראות</p>
              <p className="text-muted-foreground text-xs">הגדרות התראות — בקרוב</p>
            </div>
          </div>
          <ChevronLeft className="text-muted-foreground h-4 w-4" />
        </div>

        <div className="flex items-center justify-between border-t px-6 py-4 opacity-40">
          <div className="flex items-center gap-3">
            <Shield className="text-muted-foreground h-5 w-5" />
            <div>
              <p className="text-sm font-medium">אבטחה ו-MFA</p>
              <p className="text-muted-foreground text-xs">אימות דו-שלבי — בקרוב</p>
            </div>
          </div>
          <ChevronLeft className="text-muted-foreground h-4 w-4" />
        </div>
      </section>

      <p className="text-muted-foreground text-center text-xs">Restaurant OS · גרסה 0.1.0</p>
    </div>
  );
}
