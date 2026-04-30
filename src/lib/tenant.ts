import { notFound } from 'next/navigation';

import { createServerSupabaseClient, getAuthContext } from './supabase/server';

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
};

/**
 * Resolves a tenant by slug and verifies the current user is a member.
 *
 * Fast path: if the JWT custom claim `tenant_id` matches the tenant resolved
 * by slug, we skip a second DB round-trip for membership verification.
 * Slow path: if claims are absent (e.g. token not yet refreshed after joining
 * a tenant) we fall back to a direct tenant_members query.
 *
 * Calls notFound() if the tenant doesn't exist or the user lacks access.
 */
export async function requireTenant(tenantSlug: string): Promise<Tenant> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', tenantSlug)
    .single();

  if (error || !data) {
    notFound();
  }

  const tenant = data as Tenant;

  // Try to verify membership via JWT claims first (no extra DB query).
  const ctx = await getAuthContext();

  if (ctx?.tenantId === tenant.id) {
    return tenant;
  }

  // Slow path: JWT claims absent or stale — verify membership in DB.
  const { data: membership, error: memberError } = await supabase
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('user_id', ctx?.userId ?? '')
    .single();

  if (memberError || !membership) {
    notFound();
  }

  return tenant;
}
