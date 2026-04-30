import type { MenuItem, RecipeComponent, RecipeWithComponents } from '@/lib/types';

export function computeComponentCost(
  component: RecipeComponent,
  ingredientCosts: Map<string, number>,
): number {
  if (component.ingredientId) {
    const costPerUnit = ingredientCosts.get(component.ingredientId) ?? 0;
    return costPerUnit * component.qty;
  }
  // Sub-recipe cost is looked up separately by the caller via subRecipeCosts.
  return 0;
}

export function computeRecipeCost(
  recipe: RecipeWithComponents,
  ingredientCosts: Map<string, number>,
  subRecipeCosts: Map<string, number>,
): number {
  return recipe.components.reduce((sum, component) => {
    if (component.ingredientId) {
      const costPerUnit = ingredientCosts.get(component.ingredientId) ?? 0;
      return sum + costPerUnit * component.qty;
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
): { costCents: number; fcPercent: number; marginCents: number } {
  const costCents = computeRecipeCost(recipe, ingredientCosts, new Map());
  const priceCents = menuItem.priceCents;
  const fcPercent = priceCents > 0 ? (costCents / priceCents) * 100 : 0;
  const marginCents = priceCents - costCents;
  return { costCents, fcPercent, marginCents };
}
