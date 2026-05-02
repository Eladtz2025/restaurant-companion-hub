'use server';

import { logAuditEvent } from '@/lib/audit/logger';
import { createServerSupabaseClient, getAuthContext } from '@/lib/supabase/server';
import { assertRole } from '@/lib/tenant';

import type { MenuItem } from '@/lib/types';

function rowToMenuItem(row: Record<string, unknown>): MenuItem {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    posExternalId: (row.pos_external_id as string | null) ?? null,
    nameHe: row.name_he as string,
    nameEn: (row.name_en as string | null) ?? null,
    category: row.category as string,
    priceCents: row.price_cents as number,
    active: row.active as boolean,
    recipeId: (row.recipe_id as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getMenuItems(tenantId: string): Promise<MenuItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('category')
    .order('name_he');
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToMenuItem);
}

export async function getMenuItem(tenantId: string, id: string): Promise<MenuItem | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single();
  if (error?.code === 'PGRST116') return null;
  if (error) throw new Error(error.message);
  return data ? rowToMenuItem(data) : null;
}

export async function createMenuItem(
  tenantId: string,
  data: {
    nameHe: string;
    nameEn?: string | null;
    category: string;
    priceCents: number;
    posExternalId?: string | null;
    active?: boolean;
  },
): Promise<MenuItem> {
  const supabase = await createServerSupabaseClient();
  const { data: row, error } = await supabase
    .from('menu_items')
    .insert({
      tenant_id: tenantId,
      name_he: data.nameHe,
      name_en: data.nameEn ?? null,
      category: data.category,
      price_cents: data.priceCents,
      pos_external_id: data.posExternalId ?? null,
      active: data.active ?? true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToMenuItem(row);
}

export async function updateMenuItem(
  tenantId: string,
  id: string,
  data: Partial<{
    nameHe: string;
    nameEn: string | null;
    category: string;
    priceCents: number;
    posExternalId: string | null;
    active: boolean;
  }>,
): Promise<MenuItem> {
  const ctx = await getAuthContext();
  const priceChanging = data.priceCents !== undefined;
  const before = priceChanging ? await getMenuItem(tenantId, id) : null;

  const supabase = await createServerSupabaseClient();
  const patch: {
    name_he?: string;
    name_en?: string | null;
    category?: string;
    price_cents?: number;
    pos_external_id?: string | null;
    active?: boolean;
  } = {};
  if (data.nameHe !== undefined) patch.name_he = data.nameHe;
  if (data.nameEn !== undefined) patch.name_en = data.nameEn;
  if (data.category !== undefined) patch.category = data.category;
  if (data.priceCents !== undefined) patch.price_cents = data.priceCents;
  if (data.posExternalId !== undefined) patch.pos_external_id = data.posExternalId;
  if (data.active !== undefined) patch.active = data.active;

  const { data: row, error } = await supabase
    .from('menu_items')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  const updated = rowToMenuItem(row);

  if (priceChanging && before && before.priceCents !== updated.priceCents && ctx) {
    await logAuditEvent({
      tenantId,
      userId: ctx.userId,
      action: 'menu_item.price_changed',
      entityType: 'menu_items',
      entityId: id,
      beforeData: { price_cents: before.priceCents },
      afterData: { price_cents: updated.priceCents },
    });
  }
  return updated;
}

export async function toggleMenuItemActive(tenantId: string, id: string): Promise<MenuItem> {
  const current = await getMenuItem(tenantId, id);
  if (!current) throw new Error('Menu item not found');
  return updateMenuItem(tenantId, id, { active: !current.active });
}

export async function deleteMenuItem(tenantId: string, id: string): Promise<void> {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error('Unauthenticated');
  const supabase = await createServerSupabaseClient();
  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', ctx.userId)
    .single();
  assertRole(membership?.role as Parameters<typeof assertRole>[0], 'owner', 'manager');

  const before = await getMenuItem(tenantId, id);
  const { error } = await supabase
    .from('menu_items')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id);
  if (error) throw new Error(error.message);

  if (before) {
    await logAuditEvent({
      tenantId,
      userId: ctx.userId,
      action: 'menu_item.deleted',
      entityType: 'menu_items',
      entityId: id,
      beforeData: { name_he: before.nameHe, price_cents: before.priceCents },
    });
  }
}

export async function linkRecipe(
  tenantId: string,
  menuItemId: string,
  recipeId: string | null,
): Promise<MenuItem> {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error('Unauthenticated');
  const supabase = await createServerSupabaseClient();
  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', ctx.userId)
    .single();
  assertRole(membership?.role as Parameters<typeof assertRole>[0], 'owner', 'manager', 'chef');
  const { data, error } = await supabase
    .from('menu_items')
    .update({ recipe_id: recipeId, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', menuItemId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToMenuItem(data as Record<string, unknown>);
}
