import { canConvert, convert } from '@/lib/units/conversions';

import type { IngredientUnit, MenuItem, RecipeComponent, RecipeWithComponents } from '@/lib/types';

const MAX_DEPTH = 5;

// ingredientUnits maps ingredient id → its storage unit (the unit cost_per_unit_cents is priced in).
// ingredientCosts maps ingredient id → cost_per_unit_cents (cost per one of that storage unit).
// If ingredient unit and component unit are compatible, we convert before multiplying.

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
      // If units are incompatible (e.g. g vs ml), use raw qty — caller's responsibility.
    }
    return costPerUnit * qty;
  }
  // Sub-recipe cost is looked up separately by the caller via subRecipeCosts.
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
  return recipe.components.reduce((sum, component) => {
    if (component.ingredientId) {
      return sum + computeComponentCost(component, ingredientCosts, ingredientUnits);
    }
    if (component.subRecipeId) {
      const subCost = subRecipeCosts.get(component.subRecipeId) ?? 0;
      return sum + subCost * component.qty;
    }
    return sum;
  }, 0);
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
