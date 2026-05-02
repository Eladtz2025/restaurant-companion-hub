'use server';

import { logAuditEvent } from '@/lib/audit/logger';
import { createServerSupabaseClient, getAuthContext } from '@/lib/supabase/server';

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
    active: boolean;
    imageUrl: string | null;
    instructionsMd: string | null;
    videoUrl: string | null;
  }>,
): Promise<Recipe> {
  const supabase = await createServerSupabaseClient();
  const patch: {
    name_he?: string;
    name_en?: string | null;
    type?: string;
    yield_qty?: number;
    yield_unit?: string;
    active?: boolean;
    image_url?: string | null;
    instructions_md?: string | null;
    video_url?: string | null;
  } = {};
  if (data.nameHe !== undefined) patch.name_he = data.nameHe;
  if (data.nameEn !== undefined) patch.name_en = data.nameEn;
  if (data.type !== undefined) patch.type = data.type;
  if (data.yieldQty !== undefined) patch.yield_qty = data.yieldQty;
  if (data.yieldUnit !== undefined) patch.yield_unit = data.yieldUnit;
  if (data.active !== undefined) patch.active = data.active;
  if (data.imageUrl !== undefined) patch.image_url = data.imageUrl;
  if (data.instructionsMd !== undefined) patch.instructions_md = data.instructionsMd;
  if (data.videoUrl !== undefined) patch.video_url = data.videoUrl;

  const { data: row, error } = await supabase
    .from('recipes')
    // Cast: image_url / instructions_md / video_url columns may not yet exist in generated types.
    .update(patch as never)
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
