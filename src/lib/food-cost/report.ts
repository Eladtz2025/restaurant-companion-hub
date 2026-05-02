import { createServerSupabaseClient } from '@/lib/supabase/server';

import { computeRecipeCost } from './calculator';

import type { IngredientUnit } from '@/lib/types';

export interface MenuItemFCRow {
  menuItemId: string;
  nameHe: string;
  category: string;
  priceCents: number;
  theoreticalCostCents: number;
  fcPercent: number;
  marginCents: number;
  missingCosts: string[]; // ingredient names with no cost set
}

export interface FCReport {
  rows: MenuItemFCRow[];
  averageFcPercent: number;
  itemsWithMissingCosts: number;
  generatedAt: Date;
}

export async function buildFCReport(tenantId: string): Promise<FCReport> {
  const supabase = await createServerSupabaseClient();

  // Fetch all active menu items
  const { data: menuItems, error: miErr } = await supabase
    .from('menu_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('category')
    .order('name_he');
  if (miErr) throw new Error(miErr.message);

  // Fetch all recipes with their components
  const { data: recipes, error: rErr } = await supabase
    .from('recipes')
    .select('*')
    .eq('tenant_id', tenantId);
  if (rErr) throw new Error(rErr.message);

  const { data: components, error: cErr } = await supabase
    .from('recipe_components')
    .select('*')
    .eq('tenant_id', tenantId);
  if (cErr) throw new Error(cErr.message);

  const { data: ingredients, error: ingErr } = await supabase
    .from('ingredients')
    .select('id, name_he, cost_per_unit_cents, unit')
    .eq('tenant_id', tenantId);
  if (ingErr) throw new Error(ingErr.message);

  // Build lookup maps
  const ingredientCosts = new Map<string, number>(
    (ingredients ?? []).map((i) => [i.id, i.cost_per_unit_cents ?? 0]),
  );
  const ingredientUnits = new Map<string, IngredientUnit>(
    (ingredients ?? []).map((i) => [i.id, i.unit as IngredientUnit]),
  );
  const ingredientNames = new Map<string, string>(
    (ingredients ?? []).map((i) => [i.id, i.name_he]),
  );

  // Group components by recipe
  const componentsByRecipe = new Map<string, Array<Record<string, unknown>>>();
  for (const c of components ?? []) {
    const list = componentsByRecipe.get(c.recipe_id as string) ?? [];
    list.push(c as Record<string, unknown>);
    componentsByRecipe.set(c.recipe_id as string, list);
  }

  // Build RecipeWithComponents for each recipe
  const recipeMap = new Map<
    string,
    { recipe: Record<string, unknown>; components: Array<Record<string, unknown>> }
  >();
  for (const r of recipes ?? []) {
    recipeMap.set(r.id as string, {
      recipe: r as Record<string, unknown>,
      components: componentsByRecipe.get(r.id as string) ?? [],
    });
  }

  // Compute sub-recipe costs first
  const subRecipeCosts = new Map<string, number>();
  for (const [id, { recipe, components: comps }] of recipeMap) {
    if (comps.every((c) => c.ingredient_id !== null)) {
      const recipeWithComponents = {
        id: recipe.id as string,
        tenantId: recipe.tenant_id as string,
        nameHe: recipe.name_he as string,
        nameEn: (recipe.name_en as string | null) ?? null,
        type: recipe.type as 'menu' | 'prep',
        yieldQty: Number(recipe.yield_qty),
        yieldUnit: recipe.yield_unit as IngredientUnit,
        active: recipe.active as boolean,
        createdAt: recipe.created_at as string,
        updatedAt: recipe.updated_at as string,
        components: comps.map((c) => ({
          id: c.id as string,
          tenantId: c.tenant_id as string,
          recipeId: c.recipe_id as string,
          ingredientId: (c.ingredient_id as string | null) ?? null,
          subRecipeId: (c.sub_recipe_id as string | null) ?? null,
          qty: Number(c.qty),
          unit: c.unit as IngredientUnit,
          sortOrder: c.sort_order as number,
          createdAt: c.created_at as string,
        })),
      };
      subRecipeCosts.set(
        id,
        computeRecipeCost(recipeWithComponents, ingredientCosts, new Map(), ingredientUnits),
      );
    }
  }

  // Build report rows
  const rows: MenuItemFCRow[] = [];

  for (const mi of menuItems ?? []) {
    const recipeId = mi.recipe_id as string | null;
    if (!recipeId || !recipeMap.has(recipeId)) {
      rows.push({
        menuItemId: mi.id as string,
        nameHe: mi.name_he as string,
        category: mi.category as string,
        priceCents: mi.price_cents as number,
        theoreticalCostCents: 0,
        fcPercent: 0,
        marginCents: mi.price_cents as number,
        missingCosts: [],
      });
      continue;
    }

    const { recipe, components: comps } = recipeMap.get(recipeId)!;
    const recipeWithComponents = {
      id: recipe.id as string,
      tenantId: recipe.tenant_id as string,
      nameHe: recipe.name_he as string,
      nameEn: (recipe.name_en as string | null) ?? null,
      type: recipe.type as 'menu' | 'prep',
      yieldQty: Number(recipe.yield_qty),
      yieldUnit: recipe.yield_unit as IngredientUnit,
      active: recipe.active as boolean,
      createdAt: recipe.created_at as string,
      updatedAt: recipe.updated_at as string,
      components: comps.map((c) => ({
        id: c.id as string,
        tenantId: c.tenant_id as string,
        recipeId: c.recipe_id as string,
        ingredientId: (c.ingredient_id as string | null) ?? null,
        subRecipeId: (c.sub_recipe_id as string | null) ?? null,
        qty: Number(c.qty),
        unit: c.unit as IngredientUnit,
        sortOrder: c.sort_order as number,
        createdAt: c.created_at as string,
      })),
    };

    const missingCosts: string[] = [];
    for (const c of recipeWithComponents.components) {
      if (c.ingredientId && !ingredientCosts.has(c.ingredientId)) {
        missingCosts.push(ingredientNames.get(c.ingredientId) ?? c.ingredientId);
      }
    }

    const theoreticalCostCents = Math.round(
      computeRecipeCost(recipeWithComponents, ingredientCosts, subRecipeCosts, ingredientUnits),
    );
    const priceCents = mi.price_cents as number;
    const fcPercent = priceCents > 0 ? (theoreticalCostCents / priceCents) * 100 : 0;

    rows.push({
      menuItemId: mi.id as string,
      nameHe: mi.name_he as string,
      category: mi.category as string,
      priceCents,
      theoreticalCostCents,
      fcPercent,
      marginCents: priceCents - theoreticalCostCents,
      missingCosts,
    });
  }

  const linkedRows = rows.filter((r) => r.theoreticalCostCents > 0 || r.missingCosts.length > 0);
  const averageFcPercent =
    linkedRows.length > 0
      ? linkedRows.reduce((sum, r) => sum + r.fcPercent, 0) / linkedRows.length
      : 0;

  return {
    rows,
    averageFcPercent,
    itemsWithMissingCosts: rows.filter((r) => r.missingCosts.length > 0).length,
    generatedAt: new Date(),
  };
}
