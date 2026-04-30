import { describe, expect, it } from 'vitest';

import { computeComponentCost } from '@/lib/food-cost/calculator';
import { canConvert, convert, normalizeToBase } from '@/lib/units/conversions';

import type { RecipeComponent } from '@/lib/types';

function makeComponent(
  overrides: Partial<RecipeComponent> & Pick<RecipeComponent, 'qty' | 'unit'>,
): RecipeComponent {
  return {
    id: 'c1',
    tenantId: 't1',
    recipeId: 'r1',
    ingredientId: 'i1',
    subRecipeId: null,
    sortOrder: 0,
    createdAt: '2026-01-01',
    ...overrides,
  };
}

// ── canConvert ───────────────────────────────────────────────────────────────

describe('canConvert', () => {
  it('kg and g are compatible (both weight)', () => {
    expect(canConvert('kg', 'g')).toBe(true);
    expect(canConvert('g', 'kg')).toBe(true);
  });

  it('l and ml are compatible (both volume)', () => {
    expect(canConvert('l', 'ml')).toBe(true);
  });

  it('g and ml are incompatible (weight vs volume)', () => {
    expect(canConvert('g', 'ml')).toBe(false);
  });

  it('unit and pkg are compatible (both countable)', () => {
    expect(canConvert('unit', 'pkg')).toBe(true);
  });
});

// ── convert ──────────────────────────────────────────────────────────────────

describe('convert', () => {
  it('1 kg → 1000 g', () => {
    expect(convert(1, 'kg', 'g')).toBe(1000);
  });

  it('500 g → 0.5 kg', () => {
    expect(convert(500, 'g', 'kg')).toBe(0.5);
  });

  it('500 ml → 0.5 l', () => {
    expect(convert(500, 'ml', 'l')).toBe(0.5);
  });

  it('2 l → 2000 ml', () => {
    expect(convert(2, 'l', 'ml')).toBe(2000);
  });

  it('throws when converting g to ml (incompatible units)', () => {
    expect(() => convert(100, 'g', 'ml')).toThrow();
  });

  it('same unit returns same value', () => {
    expect(convert(250, 'g', 'g')).toBe(250);
  });
});

// ── normalizeToBase ──────────────────────────────────────────────────────────

describe('normalizeToBase', () => {
  it('normalizes 2 kg → 2000 g (base unit)', () => {
    const result = normalizeToBase(2, 'kg');
    expect(result.qty).toBe(2000);
    expect(result.baseUnit).toBe('g');
  });

  it('normalizes 500 ml → 500 ml (already base unit)', () => {
    const result = normalizeToBase(500, 'ml');
    expect(result.qty).toBe(500);
    expect(result.baseUnit).toBe('ml');
  });
});

// ── computeComponentCost with unit mismatch ──────────────────────────────────

describe('computeComponentCost with unit conversion', () => {
  it('recipe uses 200g of ingredient priced per kg → correct cost', () => {
    // ingredient cost = 1500 agorot per kg = 1.5 agorot per g
    // component uses 200g → cost = 200 * 1.5 = 300 agorot
    const component = makeComponent({ qty: 200, unit: 'g' });
    const ingredientCosts = new Map([['i1', 1500]]); // per kg
    const ingredientUnits = new Map<string, import('@/lib/types').IngredientUnit>([['i1', 'kg']]);
    expect(computeComponentCost(component, ingredientCosts, ingredientUnits)).toBe(300);
  });

  it('recipe uses 2l of ingredient priced per ml → correct cost', () => {
    // ingredient cost = 1 agorot per ml
    // component uses 2l = 2000ml → cost = 2000
    const component = makeComponent({ qty: 2, unit: 'l' });
    const ingredientCosts = new Map([['i1', 1]]);
    const ingredientUnits = new Map<string, import('@/lib/types').IngredientUnit>([['i1', 'ml']]);
    expect(computeComponentCost(component, ingredientCosts, ingredientUnits)).toBe(2000);
  });
});
