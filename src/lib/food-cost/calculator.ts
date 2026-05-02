import { canConvert, convert } from '@/lib/units/conversions';

import type { IngredientUnit, MenuItem, RecipeComponent, RecipeWithComponents } from '@/lib/types';

const MAX_DEPTH = 5;

export function computeComponentCost(
  component: RecipeComponent,
  ingredientCosts: Map<string, number>,
  ingredientUnits?: Map<string, IngredientUnit>,
): number {
  if (component.ingredientId) {
    const costPerUnit = ingredientCosts.get(component.ingredientId) ?? 0;
    const ingredientUnit = ingredientUnits?.get(component.ingredientId);
    let qty = component.qty;
    if (ingredientUnit && ingredientUnit !== component.unit) {
      if (canConvert(component.unit, ingredientUnit)) {
        qty = convert(component.qty, component.unit, ingredientUnit);
      }
    }
    return costPerUnit * qty;
  }
  return 0;
}

export interface RecipeCostResult {
  totalCents: number;
  warnings: string[];
}

export function computeRecipeCostWithWarnings(
  recipe: RecipeWithComponents,
  ingredientCosts: Map<string, number>,
  subRecipeCosts: Map<string, number>,
  ingredientUnits?: Map<string, IngredientUnit>,
  depth = 0,
): RecipeCostResult {
  if (depth > MAX_DEPTH) {
    throw new Error(
      `Max sub-recipe depth (${MAX_DEPTH}) exceeded — possible cycle in recipe "${recipe.nameHe}"`,
    );
  }

  const warnings: string[] = [];
  let total = 0;

  for (const component of recipe.components) {
    if (component.ingredientId) {
      if (!ingredientCosts.has(component.ingredientId)) {
        warnings.push(`מרכיב ${component.ingredientId} חסר מחיר`);
      }
      total += computeComponentCost(component, ingredientCosts, ingredientUnits);
    } else if (component.subRecipeId) {
      if (!subRecipeCosts.has(component.subRecipeId)) {
        warnings.push(`תת-מתכון ${component.subRecipeId} חסר עלות`);
      }
      const subCost = subRecipeCosts.get(component.subRecipeId) ?? 0;
      total += subCost * component.qty;
    }
  }

  return { totalCents: total, warnings };
}

export function computeRecipeCost(
  recipe: RecipeWithComponents,
  ingredientCosts: Map<string, number>,
  subRecipeCosts: Map<string, number>,
  ingredientUnits?: Map<string, IngredientUnit>,
): number {
  return computeRecipeCostWithWarnings(recipe, ingredientCosts, subRecipeCosts, ingredientUnits)
    .totalCents;
}

export function computeMenuItemFC(
  menuItem: MenuItem,
  recipe: RecipeWithComponents,
  ingredientCosts: Map<string, number>,
  ingredientUnits?: Map<string, IngredientUnit>,
): { costCents: number; fcPercent: number; marginCents: number } {
  const costCents = computeRecipeCost(recipe, ingredientCosts, new Map(), ingredientUnits);
  const priceCents = menuItem.priceCents;
  const fcPercent = priceCents > 0 ? (costCents / priceCents) * 100 : 0;
  const marginCents = priceCents - costCents;
  return { costCents, fcPercent, marginCents };
}
