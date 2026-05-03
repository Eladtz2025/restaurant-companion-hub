import { describe, expect, it } from 'vitest';

import {
  computeComponentCost,
  computeMenuItemFC,
  computeRecipeCost,
} from '@/lib/food-cost/calculator';

import type { MenuItem, RecipeComponent, RecipeWithComponents } from '@/lib/types';

function makeComponent(
  overrides: Partial<RecipeComponent> & Pick<RecipeComponent, 'qty' | 'unit'>,
): RecipeComponent {
  return {
    id: 'c1',
    tenantId: 't1',
    recipeId: 'r1',
    ingredientId: null,
    subRecipeId: null,
    sortOrder: 0,
    createdAt: '2026-01-01',
    ...overrides,
  };
}

function makeRecipe(components: RecipeComponent[]): RecipeWithComponents {
  return {
    id: 'r1',
    tenantId: 't1',
    nameHe: 'מנה',
    nameEn: null,
    type: 'menu',
    yieldQty: 1,
    yieldUnit: 'unit',
    active: true,
    imageUrl: null,
    instructionsMd: null,
    videoUrl: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    components,
  };
}

function makeMenuItem(priceCents: number): MenuItem {
  return {
    id: 'm1',
    tenantId: 't1',
    posExternalId: null,
    nameHe: 'שניצל',
    nameEn: null,
    category: 'main',
    priceCents,
    active: true,
    recipeId: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

// ── computeComponentCost ─────────────────────────────────────────────────────

describe('computeComponentCost', () => {
  it('returns qty * cost for an ingredient component', () => {
    const component = makeComponent({ ingredientId: 'i1', qty: 200, unit: 'g' });
    const costs = new Map([['i1', 15]]); // 15 agorot per g
    expect(computeComponentCost(component, costs)).toBe(3000);
  });

  it('returns 0 for sub-recipe component (handled by caller)', () => {
    const component = makeComponent({ subRecipeId: 'r2', qty: 1, unit: 'unit' });
    const costs = new Map<string, number>();
    expect(computeComponentCost(component, costs)).toBe(0);
  });

  it('returns 0 when ingredient cost is missing from map', () => {
    const component = makeComponent({ ingredientId: 'missing', qty: 100, unit: 'g' });
    expect(computeComponentCost(component, new Map())).toBe(0);
  });
});

// ── computeRecipeCost ────────────────────────────────────────────────────────

describe('computeRecipeCost', () => {
  it('sums costs for a recipe with 3 ingredients', () => {
    const components = [
      makeComponent({ id: 'c1', ingredientId: 'i1', qty: 200, unit: 'g' }),
      makeComponent({ id: 'c2', ingredientId: 'i2', qty: 50, unit: 'g' }),
      makeComponent({ id: 'c3', ingredientId: 'i3', qty: 10, unit: 'ml' }),
    ];
    const recipe = makeRecipe(components);
    const ingredientCosts = new Map([
      ['i1', 10], // 10 per g → 2000
      ['i2', 20], // 20 per g → 1000
      ['i3', 5], // 5 per ml → 50
    ]);
    expect(computeRecipeCost(recipe, ingredientCosts, new Map())).toBe(3050);
  });

  it('includes sub-recipe cost via subRecipeCosts map', () => {
    const components = [
      makeComponent({ id: 'c1', ingredientId: 'i1', qty: 100, unit: 'g' }),
      makeComponent({ id: 'c2', subRecipeId: 'r2', qty: 2, unit: 'unit' }),
    ];
    const recipe = makeRecipe(components);
    const ingredientCosts = new Map([['i1', 5]]); // 500
    const subRecipeCosts = new Map([['r2', 300]]); // 2 * 300 = 600
    expect(computeRecipeCost(recipe, ingredientCosts, subRecipeCosts)).toBe(1100);
  });

  it('returns 0 for a recipe with no components', () => {
    const recipe = makeRecipe([]);
    expect(computeRecipeCost(recipe, new Map(), new Map())).toBe(0);
  });

  it('handles missing sub-recipe cost gracefully (treats as 0)', () => {
    const components = [makeComponent({ subRecipeId: 'unknown', qty: 1, unit: 'unit' })];
    const recipe = makeRecipe(components);
    expect(computeRecipeCost(recipe, new Map(), new Map())).toBe(0);
  });
});

// ── computeMenuItemFC ────────────────────────────────────────────────────────

describe('computeMenuItemFC', () => {
  it('computes FC% correctly — price 5000, cost 1500 → 30%', () => {
    const components = [makeComponent({ ingredientId: 'i1', qty: 1, unit: 'unit' })];
    const recipe = makeRecipe(components);
    const menuItem = makeMenuItem(5000);
    const ingredientCosts = new Map([['i1', 1500]]);
    const result = computeMenuItemFC(menuItem, recipe, ingredientCosts);
    expect(result.costCents).toBe(1500);
    expect(result.fcPercent).toBeCloseTo(30, 5);
    expect(result.marginCents).toBe(3500);
  });

  it('returns fcPercent 0 when price is 0 (no division by zero)', () => {
    const recipe = makeRecipe([]);
    const menuItem = makeMenuItem(0);
    const result = computeMenuItemFC(menuItem, recipe, new Map());
    expect(result.fcPercent).toBe(0);
    expect(result.costCents).toBe(0);
  });

  it('handles zero-cost recipe — margin equals full price', () => {
    const recipe = makeRecipe([]);
    const menuItem = makeMenuItem(4000);
    const result = computeMenuItemFC(menuItem, recipe, new Map());
    expect(result.marginCents).toBe(4000);
    expect(result.fcPercent).toBe(0);
  });

  it('handles 100% food cost scenario', () => {
    const components = [makeComponent({ ingredientId: 'i1', qty: 1, unit: 'unit' })];
    const recipe = makeRecipe(components);
    const menuItem = makeMenuItem(2000);
    const ingredientCosts = new Map([['i1', 2000]]);
    const result = computeMenuItemFC(menuItem, recipe, ingredientCosts);
    expect(result.fcPercent).toBeCloseTo(100, 5);
    expect(result.marginCents).toBe(0);
  });
});
