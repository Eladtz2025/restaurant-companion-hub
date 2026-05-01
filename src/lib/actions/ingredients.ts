'use server';

import { logAuditEvent } from '@/lib/audit/logger';
import { createServerSupabaseClient, getAuthContext } from '@/lib/supabase/server';

import { IngredientSchema } from './ingredients.types';

import type { Ingredient, IngredientCategory, IngredientUnit } from '@/lib/types';

type Result<T> = { data: T } | { error: string };

function rowToIngredient(row: Record<string, unknown>): Ingredient {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    nameHe: row.name_he as string,
    nameEn: (row.name_en as string | null) ?? null,
    unit: row.unit as IngredientUnit,
    category: (row.category as IngredientCategory) ?? 'other',
    costPerUnitCents: row.cost_per_unit_cents as number,
    pkgQty: (row.pkg_qty as number | null) ?? null,
    active: row.active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getIngredients(
  tenantId: string,
  options?: { search?: string; category?: IngredientCategory },
): Promise<Result<Ingredient[]>> {
  try {
    const supabase = await createServerSupabaseClient();
    let query = supabase.from('ingredients').select('*').eq('tenant_id', tenantId).order('name_he');

    if (options?.search) {
      query = query.ilike('name_he', `%${options.search}%`);
    }
    if (options?.category) {
      query = query.eq('category', options.category);
    }

    const { data, error } = await query;
    if (error) return { error: error.message };
    return { data: (data ?? []).map(rowToIngredient) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function getIngredient(
  tenantId: string,
  id: string,
): Promise<Result<Ingredient | null>> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();
    if (error?.code === 'PGRST116') return { data: null };
    if (error) return { error: error.message };
    return { data: data ? rowToIngredient(data) : null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function createIngredient(
  tenantId: string,
  input: {
    nameHe: string;
    nameEn?: string | null;
    unit: IngredientUnit;
    category: IngredientCategory;
    costPerUnitCents?: number;
    pkgQty?: number | null;
    active?: boolean;
  },
): Promise<Result<Ingredient>> {
  const parsed = IngredientSchema.safeParse({
    name_he: input.nameHe,
    unit: input.unit,
    category: input.category,
    current_cost_per_unit_cents: input.costPerUnitCents,
    pkg_qty: input.pkgQty ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(', ') };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: row, error } = await supabase
      .from('ingredients')
      .insert({
        tenant_id: tenantId,
        name_he: input.nameHe,
        name_en: input.nameEn ?? null,
        unit: input.unit,
        category: input.category,
        cost_per_unit_cents: input.costPerUnitCents ?? 0,
        pkg_qty: input.pkgQty ?? null,
        active: input.active ?? true,
      })
      .select()
      .single();
    if (error) return { error: error.message };
    return { data: rowToIngredient(row) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function updateIngredient(
  tenantId: string,
  id: string,
  input: Partial<{
    nameHe: string;
    nameEn: string | null;
    unit: IngredientUnit;
    category: IngredientCategory;
    costPerUnitCents: number;
    pkgQty: number | null;
    active: boolean;
  }>,
): Promise<Result<Ingredient>> {
  const patch: {
    name_he?: string;
    name_en?: string | null;
    unit?: string;
    category?: string;
    cost_per_unit_cents?: number;
    pkg_qty?: number | null;
    active?: boolean;
  } = {};
  if (input.nameHe !== undefined) patch.name_he = input.nameHe;
  if (input.nameEn !== undefined) patch.name_en = input.nameEn;
  if (input.unit !== undefined) patch.unit = input.unit;
  if (input.category !== undefined) patch.category = input.category;
  if (input.costPerUnitCents !== undefined) patch.cost_per_unit_cents = input.costPerUnitCents;
  if (input.pkgQty !== undefined) patch.pkg_qty = input.pkgQty;
  if (input.active !== undefined) patch.active = input.active;

  try {
    const supabase = await createServerSupabaseClient();
    const { data: row, error } = await supabase
      .from('ingredients')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .single();
    if (error) return { error: error.message };
    return { data: rowToIngredient(row) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function deleteIngredient(tenantId: string, id: string): Promise<Result<void>> {
  try {
    const ctx = await getAuthContext();
    const existing = await getIngredient(tenantId, id);
    const before = 'data' in existing ? existing.data : null;

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from('ingredients')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', id);
    if (error) return { error: error.message };

    if (before && ctx) {
      await logAuditEvent({
        tenantId,
        userId: ctx.userId,
        action: 'ingredient.deleted',
        entityType: 'ingredients',
        entityId: id,
        beforeData: {
          name_he: before.nameHe,
          unit: before.unit,
          category: before.category,
          cost_per_unit_cents: before.costPerUnitCents,
        },
      });
    }

    return { data: undefined };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
