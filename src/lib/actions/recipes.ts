'use server';

import { logAuditEvent } from '@/lib/audit/logger';
import { createServerSupabaseClient, getAuthContext } from '@/lib/supabase/server';
import { assertRole } from '@/lib/tenant';

import type {
  IngredientUnit,
  Recipe,
  RecipeComponent,
  RecipeType,
  RecipeWithComponents,
} from '@/lib/types';

function rowToRecipe(row: Record<string, unknown>): Recipe {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    nameHe: row.name_he as string,
    nameEn: (row.name_en as string | null) ?? null,
    type: row.type as RecipeType,
    yieldQty: Number(row.yield_qty),
    yieldUnit: row.yield_unit as IngredientUnit,
    imageUrl: (row.image_url as string | null) ?? null,
    instructionsMd: (row.instructions_md as string | null) ?? null,
    videoUrl: (row.video_url as string | null) ?? null,
    active: row.active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToComponent(row: Record<string, unknown>): RecipeComponent {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    recipeId: row.recipe_id as string,
    ingredientId: (row.ingredient_id as string | null) ?? null,
    subRecipeId: (row.sub_recipe_id as string | null) ?? null,
    qty: Number(row.qty),
    unit: row.unit as IngredientUnit,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
  };
}

export async function getRecipes(tenantId: string, type?: RecipeType): Promise<Recipe[]> {
  const supabase = await createServerSupabaseClient();
  let q = supabase.from('recipes').select('*').eq('tenant_id', tenantId).order('name_he');
  if (type) q = q.eq('type', type);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToRecipe);
}

export async function getRecipeWithComponents(
  tenantId: string,
  id: string,
): Promise<RecipeWithComponents | null> {
  const supabase = await createServerSupabaseClient();
  const [recipeRes, componentsRes] = await Promise.all([
    supabase.from('recipes').select('*').eq('tenant_id', tenantId).eq('id', id).single(),
    supabase
      .from('recipe_components')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('recipe_id', id)
      .order('sort_order'),
  ]);
  if (recipeRes.error?.code === 'PGRST116') return null;
  if (recipeRes.error) throw new Error(recipeRes.error.message);
  if (componentsRes.error) throw new Error(componentsRes.error.message);
  return {
    ...rowToRecipe(recipeRes.data),
    components: (componentsRes.data ?? []).map(rowToComponent),
  };
}

export async function createRecipe(
  tenantId: string,
  data: {
    nameHe: string;
    nameEn?: string | null;
    type: RecipeType;
    yieldQty?: number;
    yieldUnit?: IngredientUnit;
    active?: boolean;
  },
): Promise<Recipe> {
  const supabase = await createServerSupabaseClient();
  const { data: row, error } = await supabase
    .from('recipes')
    .insert({
      tenant_id: tenantId,
      name_he: data.nameHe,
      name_en: data.nameEn ?? null,
      type: data.type,
      yield_qty: data.yieldQty ?? 1,
      yield_unit: data.yieldUnit ?? 'unit',
      active: data.active ?? true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToRecipe(row);
}

export async function updateRecipe(
  tenantId: string,
  id: string,
  data: Partial<{
    nameHe: string;
    nameEn: string | null;
    type: RecipeType;
    yieldQty: number;
    yieldUnit: IngredientUnit;
    imageUrl: string | null;
    instructionsMd: string | null;
    videoUrl: string | null;
    active: boolean;
  }>,
): Promise<Recipe> {
  const supabase = await createServerSupabaseClient();
  const patch: {
    name_he?: string;
    name_en?: string | null;
    type?: string;
    yield_qty?: number;
    yield_unit?: string;
    image_url?: string | null;
    instructions_md?: string | null;
    video_url?: string | null;
    active?: boolean;
  } = {};
  if (data.nameHe !== undefined) patch.name_he = data.nameHe;
  if (data.nameEn !== undefined) patch.name_en = data.nameEn;
  if (data.type !== undefined) patch.type = data.type;
  if (data.yieldQty !== undefined) patch.yield_qty = data.yieldQty;
  if (data.yieldUnit !== undefined) patch.yield_unit = data.yieldUnit;
  if (data.imageUrl !== undefined) patch.image_url = data.imageUrl;
  if (data.instructionsMd !== undefined) patch.instructions_md = data.instructionsMd;
  if (data.videoUrl !== undefined) patch.video_url = data.videoUrl;
  if (data.active !== undefined) patch.active = data.active;

  const { data: row, error } = await supabase
    .from('recipes')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToRecipe(row);
}

export async function addComponent(
  tenantId: string,
  recipeId: string,
  component: {
    ingredientId?: string | null;
    subRecipeId?: string | null;
    qty: number;
    unit: IngredientUnit;
    sortOrder?: number;
  },
): Promise<RecipeComponent> {
  const supabase = await createServerSupabaseClient();
  const { data: row, error } = await supabase
    .from('recipe_components')
    .insert({
      tenant_id: tenantId,
      recipe_id: recipeId,
      ingredient_id: component.ingredientId ?? null,
      sub_recipe_id: component.subRecipeId ?? null,
      qty: component.qty,
      unit: component.unit,
      sort_order: component.sortOrder ?? 0,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToComponent(row);
}

export async function updateComponent(
  tenantId: string,
  componentId: string,
  data: Partial<{ qty: number; unit: IngredientUnit; sortOrder: number }>,
): Promise<RecipeComponent> {
  const supabase = await createServerSupabaseClient();
  const patch: { qty?: number; unit?: string; sort_order?: number } = {};
  if (data.qty !== undefined) patch.qty = data.qty;
  if (data.unit !== undefined) patch.unit = data.unit;
  if (data.sortOrder !== undefined) patch.sort_order = data.sortOrder;

  const { data: row, error } = await supabase
    .from('recipe_components')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('id', componentId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToComponent(row);
}

export async function removeComponent(tenantId: string, componentId: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from('recipe_components')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', componentId);
  if (error) throw new Error(error.message);
}

export async function deleteRecipe(tenantId: string, id: string): Promise<void> {
  const ctx = await getAuthContext();
  const before = await getRecipeWithComponents(tenantId, id);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('recipes').delete().eq('tenant_id', tenantId).eq('id', id);
  if (error) throw new Error(error.message);

  if (before && ctx) {
    await logAuditEvent({
      tenantId,
      userId: ctx.userId,
      action: 'recipe.deleted',
      entityType: 'recipes',
      entityId: id,
      beforeData: {
        name_he: before.nameHe,
        type: before.type,
        component_count: before.components.length,
      },
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = { from: (table: string) => any };

export async function getRecipeVersions(
  tenantId: string,
  recipeId: string,
): Promise<import('@/lib/types').RecipeVersion[]> {
  const supabase = await createServerSupabaseClient();
  const db = supabase as unknown as AnySupabase;
  const { data, error } = await db
    .from('recipe_versions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('recipe_id', recipeId)
    .order('version', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    recipeId: row.recipe_id as string,
    version: row.version as number,
    changeNote: (row.change_note as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
}

async function getRoleForTenant(tenantId: string): Promise<string | null> {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', ctx.userId)
    .single();
  return (data?.role as string | null) ?? null;
}

export async function saveRecipeVersion(
  tenantId: string,
  recipeId: string,
  changeNote: string | null,
): Promise<void> {
  const role = await getRoleForTenant(tenantId);
  assertRole(role as Parameters<typeof assertRole>[0], 'owner', 'manager', 'chef');
  const supabase = await createServerSupabaseClient();
  const db = supabase as unknown as AnySupabase;
  const { data: last } = await db
    .from('recipe_versions')
    .select('version')
    .eq('tenant_id', tenantId)
    .eq('recipe_id', recipeId)
    .order('version', { ascending: false })
    .limit(1)
    .single();
  const nextVersion = last ? (last.version as number) + 1 : 1;
  const { error } = await db.from('recipe_versions').insert({
    tenant_id: tenantId,
    recipe_id: recipeId,
    version: nextVersion,
    change_note: changeNote ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function restoreRecipeVersion(
  tenantId: string,
  recipeId: string,
  version: number,
): Promise<void> {
  const role = await getRoleForTenant(tenantId);
  assertRole(role as Parameters<typeof assertRole>[0], 'owner', 'manager', 'chef');
  const supabase = await createServerSupabaseClient();
  const db = supabase as unknown as AnySupabase;
  const { error } = await db
    .from('recipe_versions')
    .update({ restored_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('recipe_id', recipeId)
    .eq('version', version);
  if (error) throw new Error(error.message);
}

export async function detectCycle(
  tenantId: string,
  recipeId: string,
  subRecipeId: string,
): Promise<boolean> {
  // BFS/DFS: starting from subRecipeId, check if we can reach recipeId via sub_recipe_id links.
  const supabase = await createServerSupabaseClient();
  const visited = new Set<string>();
  const queue = [subRecipeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === recipeId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const { data } = await supabase
      .from('recipe_components')
      .select('sub_recipe_id')
      .eq('tenant_id', tenantId)
      .eq('recipe_id', current)
      .not('sub_recipe_id', 'is', null);

    for (const row of data ?? []) {
      if (row.sub_recipe_id) queue.push(row.sub_recipe_id);
    }
  }
  return false;
}
