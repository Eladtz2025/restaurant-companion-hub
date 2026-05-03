'use server';

import { revalidatePath } from 'next/cache';

import { getAuthContext, createServerSupabaseClient } from '@/lib/supabase/server';
import { getUserRole, requireTenant } from '@/lib/tenant';

export async function updateTenantName(tenantId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) throw new Error('שם לא תקין');

  const ctx = await getAuthContext();
  if (!ctx) throw new Error('לא מחובר');

  const supabase = await createServerSupabaseClient();
  const role = await getUserRole(tenantId, ctx.userId);
  if (role !== 'owner' && role !== 'manager') throw new Error('אין הרשאה');

  const { error } = await supabase.from('tenants').update({ name: trimmed }).eq('id', tenantId);
  if (error) throw new Error(error.message);

  revalidatePath('/');
}

export async function getTenantBySlug(slug: string) {
  return requireTenant(slug);
}
