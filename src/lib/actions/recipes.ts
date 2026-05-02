'use server';

import { logAuditEvent } from '@/lib/audit/logger';
import { createServerSupabaseClient, getAuthContext } from '@/lib/supabase/server';

import type {
  IngredientUnit,
  Recipe,
  RecipeComponent,
  RecipeType,
  RecipeVersion,
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
    imageUrl: (row.image_url as string | null) ?? null,
    currentVersion: (row.current_version as number) ?? 1,
    instructionsMd: (row.instructions_md as string | null) ?? null,
    videoUrl: (row.video_url as string | null) ?? null,
  };
}

function rowToRecipeVersion(row: Record<string, unknown>): RecipeVersion {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    recipeId: row.recipe_id as string,
    version: row.version as number,
    snapshotData: row.snapshot_data as RecipeWithComponents,
    changedBy: (row.changed_by as string | null) ?? null,
    changeNote: (row.change_note as string | null) ?? null,
    createdAt: row.created_at as string,
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
    instructionsMd: string | null;
    videoUrl: string | null;
    imageUrl: string | null;
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
    instructions_md?: string | null;
    video_url?: string | null;
    image_url?: string | null;
  } = {};
  if (data.nameHe !== undefined) patch.name_he = data.nameHe;
  if (data.nameEn !== undefined) patch.name_en = data.nameEn;
  if (data.type !== undefined) patch.type = data.type;
  if (data.yieldQty !== undefined) patch.yield_qty = data.yieldQty;
  if (data.yieldUnit !== undefined) patch.yield_unit = data.yieldUnit;
  if (data.active !== undefined) patch.active = data.active;
  if (data.instructionsMd !== undefined) patch.instructions_md = data.instructionsMd;
  if (data.videoUrl !== undefined) patch.video_url = data.videoUrl;
  if (data.imageUrl !== undefined) patch.image_url = data.imageUrl;

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

export async function saveRecipeVersion(
  tenantId: string,
  recipeId: string,
  changeNote?: string,
): Promise<RecipeVersion> {
  const supabase = await createServerSupabaseClient();

  // 1. Fetch full recipe with components
  const full = await getRecipeWithComponents(tenantId, recipeId);
  if (!full) throw new Error('Recipe not found');

  // 2. Get current version number
  const currentVersion = full.currentVersion ?? 1;

  // 3. Insert into recipe_versions
  const { data: versionRow, error: insertError } = await supabase
    .from('recipe_versions')
    .insert({
      tenant_id: tenantId,
      recipe_id: recipeId,
      version: currentVersion,
      snapshot_data: full as unknown as import('@/lib/supabase/database.types').Json,
      change_note: changeNote ?? null,
    })
    .select()
    .single();
  if (insertError) throw new Error(insertError.message);

  // 4. Increment current_version on recipes
  const { error: updateError } = await supabase
    .from('recipes')
    .update({ current_version: currentVersion + 1 })
    .eq('tenant_id', tenantId)
    .eq('id', recipeId);
  if (updateError) throw new Error(updateError.message);

  return rowToRecipeVersion(versionRow as Record<string, unknown>);
}

export async function getRecipeVersions(
  tenantId: string,
  recipeId: string,
): Promise<RecipeVersion[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('recipe_versions')
    .select('*')
    .eq('recipe_id', recipeId)
    .eq('tenant_id', tenantId)
    .order('version', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToRecipeVersion(row as Record<string, unknown>));
}

export async function restoreRecipeVersion(
  tenantId: string,
  recipeId: string,
  version: number,
): Promise<RecipeWithComponents> {
  const supabase = await createServerSupabaseClient();

  // 1. Fetch the version row
  const { data: versionRow, error: fetchError } = await supabase
    .from('recipe_versions')
    .select('*')
    .eq('recipe_id', recipeId)
    .eq('tenant_id', tenantId)
    .eq('version', version)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const snapshot = (versionRow as Record<string, unknown>).snapshot_data as RecipeWithComponents;

  // 2. Delete all current recipe_components for this recipe
  const { error: deleteError } = await supabase
    .from('recipe_components')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('recipe_id', recipeId);
  if (deleteError) throw new Error(deleteError.message);

  // 3. Re-insert components from snapshot
  if (snapshot.components.length > 0) {
    const componentRows = snapshot.components.map((c) => ({
      tenant_id: tenantId,
      recipe_id: recipeId,
      ingredient_id: c.ingredientId ?? null,
      sub_recipe_id: c.subRecipeId ?? null,
      qty: c.qty,
      unit: c.unit,
      sort_order: c.sortOrder,
    }));
    const { error: insertComponentsError } = await supabase
      .from('recipe_components')
      .insert(componentRows);
    if (insertComponentsError) throw new Error(insertComponentsError.message);
  }

  // 4. Restore recipe fields from snapshot
  const { error: restoreError } = await supabase
    .from('recipes')
    .update({
      name_he: snapshot.nameHe,
      yield_qty: snapshot.yieldQty,
      yield_unit: snapshot.yieldUnit,
      instructions_md: snapshot.instructionsMd ?? null,
    })
    .eq('tenant_id', tenantId)
    .eq('id', recipeId);
  if (restoreError) throw new Error(restoreError.message);

  // 5. Create a new version snapshot of the restored state
  await saveRecipeVersion(tenantId, recipeId, `Restored from version ${version}`);

  // 6. Return the restored recipe with components
  const restored = await getRecipeWithComponents(tenantId, recipeId);
  if (!restored) throw new Error('Failed to fetch restored recipe');
  return restored;
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
