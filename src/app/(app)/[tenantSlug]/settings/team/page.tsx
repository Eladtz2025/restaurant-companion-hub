import { redirect } from 'next/navigation';

import { getAuthContext } from '@/lib/supabase/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getUserRole, requireTenant } from '@/lib/tenant';

import { TeamTable } from './TeamTable';

type PageProps = { params: Promise<{ tenantSlug: string }> };

export default async function TeamSettingsPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const tenant = await requireTenant(tenantSlug);

  const ctx = await getAuthContext();
  if (!ctx) redirect('/login');

  const userRole = await getUserRole(tenant.id, ctx.userId);

  const supabase = await createServerSupabaseClient();
  const { data: members } = await supabase
    .from('memberships')
    .select('id, user_id, role, created_at')
    .eq('tenant_id', tenant.id)
    .order('created_at');

  // Fetch auth user details via service client for display names/emails.
  // We join on profiles if present; fall back to user_id for now.
  const memberList = (members ?? []).map((m) => ({
    id: m.id,
    userId: m.user_id as string,
    role: m.role as string,
    createdAt: m.created_at as string,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">ניהול צוות</h1>
      <TeamTable
        members={memberList}
        tenantId={tenant.id}
        tenantSlug={tenantSlug}
        currentUserId={ctx.userId}
        currentUserRole={userRole}
      />
    </div>
  );
}
