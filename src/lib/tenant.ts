import { notFound } from 'next/navigation';

import { createServerSupabaseClient, getAuthContext } from './supabase/server';

import type { Role } from './permissions';

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
 * Fast path: JWT custom claim `tenant_id` matches — skip extra DB query.
 * Slow path: claims absent/stale — fall back to memberships table.
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

  const ctx = await getAuthContext();

  if (ctx?.tenantId === tenant.id) {
    return tenant;
  }

  const { data: membership, error: memberError } = await supabase
    .from('memberships')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('user_id', ctx?.userId ?? '')
    .single();

  if (memberError || !membership) {
    notFound();
  }

  return tenant;
}

export async function getUserRole(tenantId: string, userId: string): Promise<Role | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .single();

  return (data?.role as Role) ?? null;
}

export class ForbiddenError extends Error {
  constructor(message = 'אין לך הרשאה לבצע פעולה זו') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export function assertRole(userRole: Role | null | undefined, ...allowedRoles: Role[]): void {
  if (!userRole || !allowedRoles.includes(userRole)) {
    throw new ForbiddenError();
  }
}
