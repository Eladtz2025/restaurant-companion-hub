import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock next/cache before importing anything that uses it
vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => unknown) => fn,
  revalidateTag: vi.fn(),
}));

// Mock createServerSupabaseClient
const mockFrom = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() =>
    Promise.resolve({
      from: mockFrom,
    }),
  ),
}));

import { buildFCReport } from '@/lib/food-cost/report';

// Helper to build a chainable Supabase query mock that returns data
function makeQuery(data: unknown[], error: null | { message: string } = null) {
  const chain: Record<string, unknown> = {};
  const terminal = { data, error };
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.order = () => chain;
  chain.single = () => Promise.resolve(terminal);
  // Make the chain itself thenable so `await supabase.from(...).select(...).eq(...)` works
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(terminal).then(resolve);
  return chain;
}

const TENANT_ID = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const MENU_ITEM_ID = 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb';
const RECIPE_ID = 'cccccccc-cccc-1ccc-8ccc-cccccccccccc';
const INGREDIENT_ID = 'dddddddd-dddd-1ddd-8ddd-dddddddddddd';
const COMPONENT_ID = 'eeeeeeee-eeee-1eee-8eee-eeeeeeeeeeee';

function makeMenuItem(overrides: Record<string, unknown> = {}) {
  return {
    id: MENU_ITEM_ID,
    tenant_id: TENANT_ID,
    name_he: 'שניצל',
    category: 'main',
    price_cents: 5000,
    active: true,
    recipe_id: null,
    ...overrides,
  };
}

function makeRecipe(overrides: Record<string, unknown> = {}) {
  return {
    id: RECIPE_ID,
    tenant_id: TENANT_ID,
    name_he: 'שניצל מתכון',
    name_en: null,
    type: 'menu',
    yield_qty: 1,
    yield_unit: 'unit',
    active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

function makeComponent(overrides: Record<string, unknown> = {}) {
  return {
    id: COMPONENT_ID,
    tenant_id: TENANT_ID,
    recipe_id: RECIPE_ID,
    ingredient_id: INGREDIENT_ID,
    sub_recipe_id: null,
    qty: 1,
    unit: 'unit',
    sort_order: 0,
    created_at: '2026-01-01',
    ...overrides,
  };
}

function makeIngredient(overrides: Record<string, unknown> = {}) {
  return {
    id: INGREDIENT_ID,
    name_he: 'עוף',
    cost_per_unit_cents: 1500,
    unit: 'unit',
    ...overrides,
  };
}

function setupMock(
  menuItems: unknown[],
  recipes: unknown[],
  components: unknown[],
  ingredients: unknown[],
) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'menu_items') return makeQuery(menuItems);
    if (table === 'recipes') return makeQuery(recipes);
    if (table === 'recipe_components') return makeQuery(components);
    if (table === 'ingredients') return makeQuery(ingredients);
    return makeQuery([]);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildFCReport', () => {
  it('returns empty rows for tenant with no menu items', async () => {
    setupMock([], [], [], []);
    const report = await buildFCReport(TENANT_ID);
    expect(report.rows).toHaveLength(0);
    expect(report.averageFcPercent).toBe(0);
    expect(report.itemsWithMissingCosts).toBe(0);
    expect(report.generatedAt).toBeInstanceOf(Date);
  });

  it('menu item without linked recipe has 0 cost and 0 fcPercent', async () => {
    const mi = makeMenuItem({ recipe_id: null });
    setupMock([mi], [], [], []);
    const report = await buildFCReport(TENANT_ID);
    expect(report.rows).toHaveLength(1);
    const row = report.rows[0]!;
    expect(row.theoreticalCostCents).toBe(0);
    expect(row.fcPercent).toBe(0);
    expect(row.marginCents).toBe(5000);
    expect(row.missingCosts).toHaveLength(0);
  });

  it('menu item with recipe calculates correct FC%', async () => {
    const mi = makeMenuItem({ recipe_id: RECIPE_ID });
    const recipe = makeRecipe();
    const component = makeComponent({ qty: 1 });
    const ingredient = makeIngredient({ cost_per_unit_cents: 1500 });

    setupMock([mi], [recipe], [component], [ingredient]);

    const report = await buildFCReport(TENANT_ID);
    expect(report.rows).toHaveLength(1);
    const row = report.rows[0]!;
    expect(row.theoreticalCostCents).toBe(1500);
    expect(row.fcPercent).toBeCloseTo(30, 5);
    expect(row.marginCents).toBe(3500);
    expect(row.missingCosts).toHaveLength(0);
  });

  it('reports missingCosts for ingredient with no price', async () => {
    const UNKNOWN_ING_ID = 'ffffffff-ffff-1fff-8fff-ffffffffffff';
    const mi = makeMenuItem({ recipe_id: RECIPE_ID });
    const recipe = makeRecipe();
    const component = makeComponent({ ingredient_id: UNKNOWN_ING_ID });
    // No ingredient record — so cost map won't have it

    setupMock([mi], [recipe], [component], []);

    const report = await buildFCReport(TENANT_ID);
    expect(report.rows).toHaveLength(1);
    const row = report.rows[0]!;
    expect(row.missingCosts).toHaveLength(1);
    // Falls back to ingredient id when name not found
    expect(row.missingCosts[0]).toBe(UNKNOWN_ING_ID);
    expect(report.itemsWithMissingCosts).toBe(1);
  });

  it('averageFcPercent is correct average across linked items', async () => {
    const MENU_ITEM_ID_2 = '11111111-1111-1111-8111-111111111111';
    const RECIPE_ID_2 = '22222222-2222-1222-8222-222222222222';
    const COMPONENT_ID_2 = '33333333-3333-1333-8333-333333333333';
    const INGREDIENT_ID_2 = '44444444-4444-1444-8444-444444444444';

    // item1: price 5000, cost 1500 → FC% = 30
    const mi1 = makeMenuItem({ recipe_id: RECIPE_ID, price_cents: 5000 });
    // item2: price 4000, cost 2000 → FC% = 50
    const mi2 = {
      id: MENU_ITEM_ID_2,
      tenant_id: TENANT_ID,
      name_he: 'פסטה',
      category: 'main',
      price_cents: 4000,
      active: true,
      recipe_id: RECIPE_ID_2,
    };

    const recipe1 = makeRecipe();
    const recipe2 = makeRecipe({ id: RECIPE_ID_2, name_he: 'פסטה מתכון' });

    const comp1 = makeComponent({ qty: 1 });
    const comp2 = {
      id: COMPONENT_ID_2,
      tenant_id: TENANT_ID,
      recipe_id: RECIPE_ID_2,
      ingredient_id: INGREDIENT_ID_2,
      sub_recipe_id: null,
      qty: 1,
      unit: 'unit',
      sort_order: 0,
      created_at: '2026-01-01',
    };

    const ing1 = makeIngredient({ cost_per_unit_cents: 1500 }); // FC% = 30
    const ing2 = makeIngredient({
      id: INGREDIENT_ID_2,
      name_he: 'פסטה',
      cost_per_unit_cents: 2000,
    }); // FC% = 50

    setupMock([mi1, mi2], [recipe1, recipe2], [comp1, comp2], [ing1, ing2]);

    const report = await buildFCReport(TENANT_ID);
    expect(report.rows).toHaveLength(2);
    // Average of 30 and 50 = 40
    expect(report.averageFcPercent).toBeCloseTo(40, 5);
  });

  it('itemsWithMissingCosts count is correct', async () => {
    const MENU_ITEM_ID_2 = '55555555-5555-1555-8555-555555555555';
    const RECIPE_ID_2 = '66666666-6666-1666-8666-666666666666';
    const COMPONENT_ID_2 = '77777777-7777-1777-8777-777777777777';
    const MISSING_ING_ID = '88888888-8888-1888-8888-888888888888';

    // item1 has recipe with known ingredient (no missing costs)
    const mi1 = makeMenuItem({ recipe_id: RECIPE_ID });
    // item2 has recipe with unknown ingredient (missing cost)
    const mi2 = {
      id: MENU_ITEM_ID_2,
      tenant_id: TENANT_ID,
      name_he: 'סלט',
      category: 'appetizer',
      price_cents: 3000,
      active: true,
      recipe_id: RECIPE_ID_2,
    };

    const recipe1 = makeRecipe();
    const recipe2 = makeRecipe({ id: RECIPE_ID_2, name_he: 'סלט מתכון' });

    const comp1 = makeComponent({ qty: 1 }); // INGREDIENT_ID → has cost
    const comp2 = {
      id: COMPONENT_ID_2,
      tenant_id: TENANT_ID,
      recipe_id: RECIPE_ID_2,
      ingredient_id: MISSING_ING_ID,
      sub_recipe_id: null,
      qty: 1,
      unit: 'unit',
      sort_order: 0,
      created_at: '2026-01-01',
    };

    const ing1 = makeIngredient({ cost_per_unit_cents: 1500 }); // only ing1 has a cost

    setupMock([mi1, mi2], [recipe1, recipe2], [comp1, comp2], [ing1]);

    const report = await buildFCReport(TENANT_ID);
    expect(report.itemsWithMissingCosts).toBe(1);
    const missingRow = report.rows.find((r) => r.menuItemId === MENU_ITEM_ID_2);
    expect(missingRow?.missingCosts).toHaveLength(1);
  });
});
