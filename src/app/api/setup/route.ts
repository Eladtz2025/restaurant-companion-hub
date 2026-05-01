import { NextResponse } from 'next/server';

import { createServerSupabaseClient, getAuthContext } from '@/lib/supabase/server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();

  // Check if user already has a membership
  const { data: existing } = await supabase
    .from('memberships')
    .select('tenant_id, tenants(slug)')
    .eq('user_id', ctx.userId)
    .limit(1)
    .single();

  if (existing) {
    const slug = (existing.tenants as { slug: string } | null)?.slug ?? 'unknown';
    return NextResponse.redirect(
      new URL(`/${slug}`, process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
    );
  }

  // Create tenant
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({ name: 'המסעדה שלי', slug: `restaurant-${ctx.userId.slice(0, 8)}` })
    .select()
    .single();

  if (tenantError || !tenant) {
    return NextResponse.json(
      { error: tenantError?.message ?? 'Failed to create tenant' },
      { status: 500 },
    );
  }

  // Create membership
  const { error: memberError } = await supabase
    .from('memberships')
    .insert({ tenant_id: tenant.id, user_id: ctx.userId, role: 'owner' });

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.redirect(
    new URL(`/${tenant.slug}`, process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  );
}
