'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

import type { Ingredient, IngredientUnit } from '@/lib/types';

function rowToIngredient(row: Record<string, unknown>): Ingredient {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    nameHe: row.name_he as string,
    nameEn: (row.name_en as string | null) ?? null,
    unit: row.unit as IngredientUnit,
    costPerUnitCents: row.cost_per_unit_cents as number,
    pkgQty: (row.pkg_qty as number | null) ?? null,
    active: row.active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getIngredients(tenantId: string): Promise<Ingredient[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name_he');
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToIngredient);
}

export async function getIngredient(tenantId: string, id: string): Promise<Ingredient | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single();
  if (error?.code === 'PGRST116') return null;
  if (error) throw new Error(error.message);
  return data ? rowToIngredient(data) : null;
}

export async function createIngredient(
  tenantId: string,
  data: {
    nameHe: string;
    nameEn?: string | null;
    unit: IngredientUnit;
    costPerUnitCents: number;
    active?: boolean;
  },
): Promise<Ingredient> {
  const supabase = await createServerSupabaseClient();
  const { data: row, error } = await supabase
    .from('ingredients')
    .insert({
      tenant_id: tenantId,
      name_he: data.nameHe,
      name_en: data.nameEn ?? null,
      unit: data.unit,
      cost_per_unit_cents: data.costPerUnitCents,
      active: data.active ?? true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToIngredient(row);
}

export async function updateIngredient(
  tenantId: string,
  id: string,
  data: Partial<{
    nameHe: string;
    nameEn: string | null;
    unit: IngredientUnit;
    costPerUnitCents: number;
    active: boolean;
  }>,
): Promise<Ingredient> {
  const supabase = await createServerSupabaseClient();
  const patch: {
    name_he?: string;
    name_en?: string | null;
    unit?: string;
    cost_per_unit_cents?: number;
    active?: boolean;
  } = {};
  if (data.nameHe !== undefined) patch.name_he = data.nameHe;
  if (data.nameEn !== undefined) patch.name_en = data.nameEn;
  if (data.unit !== undefined) patch.unit = data.unit;
  if (data.costPerUnitCents !== undefined) patch.cost_per_unit_cents = data.costPerUnitCents;
  if (data.active !== undefined) patch.active = data.active;

  const { data: row, error } = await supabase
    .from('ingredients')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToIngredient(row);
}

export async function deleteIngredient(tenantId: string, id: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from('ingredients')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function bulkImportIngredients(
  tenantId: string,
  rows: Array<{
    nameHe: string;
    nameEn?: string | null;
    unit: IngredientUnit;
    costPerUnitCents: number;
  }>,
): Promise<Ingredient[]> {
  const supabase = await createServerSupabaseClient();
  const inserts = rows.map((r) => ({
    tenant_id: tenantId,
    name_he: r.nameHe,
    name_en: r.nameEn ?? null,
    unit: r.unit,
    cost_per_unit_cents: r.costPerUnitCents,
  }));
  const { data, error } = await supabase.from('ingredients').insert(inserts).select();
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToIngredient);
}
