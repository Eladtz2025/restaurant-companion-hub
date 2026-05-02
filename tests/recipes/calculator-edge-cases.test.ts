import { describe, expect, it } from 'vitest';

import { computeRecipeCost, computeRecipeCostWithWarnings } from '@/lib/food-cost/calculator';

import type { RecipeWithComponents } from '@/lib/types';

function makeRecipe(components: RecipeWithComponents['components']): RecipeWithComponents {
  return {
    id: 'recipe-1',
    tenantId: 'tenant-1',
    nameHe: 'מתכון בדיקה',
    nameEn: null,
    type: 'prep',
    yieldQty: 1,
    yieldUnit: 'unit',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    components,
  };
}

function makeComponent(
  overrides: Partial<RecipeWithComponents['components'][number]> = {},
): RecipeWithComponents['components'][number] {
  return {
    id: 'comp-1',
    tenantId: 'tenant-1',
    recipeId: 'recipe-1',
    ingredientId: 'ing-1',
    subRecipeId: null,
    qty: 1,
    unit: 'kg',
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('computeRecipeCostWithWarnings', () => {
  it('returns correct cost when ingredient has known price', () => {
    const recipe = makeRecipe([makeComponent({ ingredientId: 'ing-1', qty: 2 })]);
    const costs = new Map([['ing-1', 500]]);
    const { totalCents, warnings } = computeRecipeCostWithWarnings(recipe, costs, new Map());
    expect(totalCents).toBe(1000);
    expect(warnings).toHaveLength(0);
  });

  it('treats missing ingredient cost as 0 and adds warning', () => {
    const recipe = makeRecipe([makeComponent({ ingredientId: 'ing-missing', qty: 3 })]);
    const costs = new Map<string, number>();
    const { totalCents, warnings } = computeRecipeCostWithWarnings(recipe, costs, new Map());
    expect(totalCents).toBe(0);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('ing-missing');
  });

  it('adds warning for missing sub-recipe cost and treats as 0', () => {
    const recipe = makeRecipe([
      makeComponent({ ingredientId: null, subRecipeId: 'sub-missing', qty: 2 }),
    ]);
    const { totalCents, warnings } = computeRecipeCostWithWarnings(recipe, new Map(), new Map());
    expect(totalCents).toBe(0);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('sub-missing');
  });

  it('uses sub-recipe cost from map and multiplies by qty', () => {
    const recipe = makeRecipe([
      makeComponent({ ingredientId: null, subRecipeId: 'sub-1', qty: 3 }),
    ]);
    const subCosts = new Map([['sub-1', 200]]);
    const { totalCents, warnings } = computeRecipeCostWithWarnings(recipe, new Map(), subCosts);
    expect(totalCents).toBe(600);
    expect(warnings).toHaveLength(0);
  });

  it('sums multiple components correctly', () => {
    const recipe = makeRecipe([
      makeComponent({ id: 'c1', ingredientId: 'ing-1', qty: 2 }),
      makeComponent({ id: 'c2', ingredientId: 'ing-2', qty: 5 }),
    ]);
    const costs = new Map([
      ['ing-1', 100],
      ['ing-2', 50],
    ]);
    const { totalCents } = computeRecipeCostWithWarnings(recipe, costs, new Map());
    expect(totalCents).toBe(200 + 250);
  });

  it('handles empty components list with zero cost and no warnings', () => {
    const recipe = makeRecipe([]);
    const { totalCents, warnings } = computeRecipeCostWithWarnings(recipe, new Map(), new Map());
    expect(totalCents).toBe(0);
    expect(warnings).toHaveLength(0);
  });

  it('throws when max depth exceeded', () => {
    const recipe = makeRecipe([makeComponent({ ingredientId: 'ing-1', qty: 1 })]);
    const costs = new Map([['ing-1', 100]]);
    expect(() => computeRecipeCostWithWarnings(recipe, costs, new Map(), undefined, 6)).toThrow(
      /depth/i,
    );
  });

  it('does not throw at exactly max depth (depth=5)', () => {
    const recipe = makeRecipe([makeComponent({ ingredientId: 'ing-1', qty: 1 })]);
    const costs = new Map([['ing-1', 100]]);
    expect(() =>
      computeRecipeCostWithWarnings(recipe, costs, new Map(), undefined, 5),
    ).not.toThrow();
  });

  it('computeRecipeCost returns same number as totalCents', () => {
    const recipe = makeRecipe([makeComponent({ ingredientId: 'ing-1', qty: 4 })]);
    const costs = new Map([['ing-1', 250]]);
    expect(computeRecipeCost(recipe, costs, new Map())).toBe(1000);
  });

  it('collects warnings from both ingredient and sub-recipe components', () => {
    const recipe = makeRecipe([
      makeComponent({ id: 'c1', ingredientId: 'ing-missing' }),
      makeComponent({ id: 'c2', ingredientId: null, subRecipeId: 'sub-missing' }),
    ]);
    const { warnings } = computeRecipeCostWithWarnings(recipe, new Map(), new Map());
    expect(warnings).toHaveLength(2);
  });
});
