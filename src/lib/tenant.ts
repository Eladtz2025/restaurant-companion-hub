import { notFound } from 'next/navigation';

import { createServerSupabaseClient } from './supabase/server';

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
};

/**
 * Resolves a tenant by slug and verifies the current user is a member.
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

  return data;
}
