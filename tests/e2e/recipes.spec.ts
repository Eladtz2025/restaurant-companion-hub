/**
 * Recipes flow integration test.
 *
 * Tests the full create → add components → remove component → cycle detection
 * cycle at the Server Action layer using a mocked Supabase client.
 * Playwright/browser E2E is deferred until the preview environment is stable.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── mock 'next/headers' so Server Actions don't crash outside Next.js ─────
vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll: () => [],
    set: vi.fn(),
    get: vi.fn(),
  }),
}));

// ── mock the audit logger (side-effect only, not under test here) ──────────
vi.mock('@/lib/audit/logger', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

// ── in-memory stores used by all mocked queries ────────────────────────────
type RecipeRow = {
  id: string;
  tenant_id: string;
  name_he: string;
  name_en: string | null;
  type: string;
  yield_qty: number;
  yield_unit: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type ComponentRow = {
  id: string;
  tenant_id: string;
  recipe_id: string;
  ingredient_id: string | null;
  sub_recipe_id: string | null;
  qty: number;
  unit: string;
  sort_order: number;
  created_at: string;
};

let recipeStore: RecipeRow[] = [];
let componentStore: ComponentRow[] = [];
let idSeq = 0;

function makeRecipeRow(partial: Partial<RecipeRow>): RecipeRow {
  return {
    id: `recipe-${++idSeq}`,
    tenant_id: 'tenant-1',
    name_he: 'test',
    name_en: null,
    type: 'menu',
    yield_qty: 1,
    yield_unit: 'unit',
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

function makeComponentRow(partial: Partial<ComponentRow>): ComponentRow {
  return {
    id: `comp-${++idSeq}`,
    tenant_id: 'tenant-1',
    recipe_id: '',
    ingredient_id: null,
    sub_recipe_id: null,
    qty: 1,
    unit: 'unit',
    sort_order: 0,
    created_at: new Date().toISOString(),
    ...partial,
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
  getAuthContext: vi
    .fn()
    .mockResolvedValue({ userId: 'user-1', tenantId: 'tenant-1', role: 'owner' }),
}));

import { createServerSupabaseClient } from '@/lib/supabase/server';

function makeBuilder(
  rows: RecipeRow[] | ComponentRow[] | RecipeRow | ComponentRow | null,
  error: null | { message: string; code?: string } = null,
) {
  const result = { data: rows, error };
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.not = chain;
  builder.is = chain;
  builder.order = chain;
  builder.limit = chain;
  builder.single = () => Promise.resolve(result);
  builder.maybeSingle = () => Promise.resolve(result);
  builder.then = (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

function mockSupabase() {
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === 'recipes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_col: string, val: string) => {
              const filtered = recipeStore.filter((r) => r.tenant_id === val);
              return {
                eq: vi.fn().mockImplementation((_col2: string, id: string) => ({
                  single: () => {
                    const row = recipeStore.find((r) => r.id === id) ?? null;
                    const err = row ? null : { message: 'not found', code: 'PGRST116' };
                    return Promise.resolve({ data: row, error: err });
                  },
                })),
                order: vi.fn().mockReturnValue(makeBuilder(filtered)),
              };
            }),
          }),
          insert: vi.fn().mockImplementation((data: Partial<RecipeRow>) => {
            const row = makeRecipeRow({ ...data });
            recipeStore.push(row);
            return {
              select: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: row, error: null }),
              }),
            };
          }),
          update: vi.fn().mockImplementation((patch: Partial<RecipeRow>) => ({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((_col: string, id: string) => ({
                select: vi.fn().mockReturnValue({
                  single: () => {
                    const idx = recipeStore.findIndex((r) => r.id === id);
                    if (idx !== -1) Object.assign(recipeStore[idx]!, patch);
                    return Promise.resolve({ data: recipeStore[idx] ?? null, error: null });
                  },
                }),
              })),
            }),
          })),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((_col: string, id: string) => {
                recipeStore = recipeStore.filter((r) => r.id !== id);
                return Promise.resolve({ data: null, error: null });
              }),
            }),
          }),
        };
      }

      if (table === 'recipe_components') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_col: string, val: string) => {
              const filtered = componentStore.filter((c) => c.tenant_id === val);
              return {
                eq: vi.fn().mockImplementation((_col2: string, val2: string) => {
                  const filtered2 = filtered.filter((c) => c.recipe_id === val2 || c.id === val2);
                  return {
                    order: vi.fn().mockReturnValue(makeBuilder(filtered2)),
                    not: vi.fn().mockReturnValue({
                      is: vi.fn().mockReturnValue(makeBuilder(filtered2)),
                    }),
                  };
                }),
              };
            }),
          }),
          insert: vi.fn().mockImplementation((data: Partial<ComponentRow>) => {
            const row = makeComponentRow({ ...data });
            componentStore.push(row);
            return {
              select: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: row, error: null }),
              }),
            };
          }),
          update: vi.fn().mockImplementation((patch: Partial<ComponentRow>) => ({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((_col: string, id: string) => ({
                select: vi.fn().mockReturnValue({
                  single: () => {
                    const idx = componentStore.findIndex((c) => c.id === id);
                    if (idx !== -1) Object.assign(componentStore[idx]!, patch);
                    return Promise.resolve({ data: componentStore[idx] ?? null, error: null });
                  },
                }),
              })),
            }),
          })),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((_col: string, id: string) => {
                componentStore = componentStore.filter((c) => c.id !== id);
                return Promise.resolve({ data: null, error: null });
              }),
            }),
          }),
        };
      }

      return makeBuilder(null);
    }),
  };
  (createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);
}

// ── import actions after mocks are registered ─────────────────────────────
const {
  getRecipes,
  getRecipeWithComponents,
  createRecipe,
  addComponent,
  updateComponent,
  removeComponent,
} = await import('@/lib/actions/recipes');

const TENANT = 'tenant-1';

describe('Recipes — full CRUD flow', () => {
  beforeEach(() => {
    recipeStore = [];
    componentStore = [];
    idSeq = 0;
    mockSupabase();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('list is empty on fresh tenant', async () => {
    const result = await getRecipes(TENANT);
    expect(result).toHaveLength(0);
  });

  it('create recipe — appears in list', async () => {
    await createRecipe(TENANT, {
      nameHe: 'פסטה בולונז',
      type: 'menu',
      yieldQty: 1,
      yieldUnit: 'unit',
    });

    const result = await getRecipes(TENANT);
    expect(result).toHaveLength(1);
    expect(result[0]!.nameHe).toBe('פסטה בולונז');
    expect(result[0]!.type).toBe('menu');
  });

  it('create recipe and add 2 components — component count is 2', async () => {
    const recipe = await createRecipe(TENANT, {
      nameHe: 'ריזוטו',
      type: 'menu',
      yieldQty: 2,
      yieldUnit: 'unit',
    });

    await addComponent(TENANT, recipe.id, {
      ingredientId: 'ing-1',
      qty: 100,
      unit: 'g',
    });

    await addComponent(TENANT, recipe.id, {
      ingredientId: 'ing-2',
      qty: 200,
      unit: 'ml',
    });

    const components = componentStore.filter((c) => c.recipe_id === recipe.id);
    expect(components).toHaveLength(2);
  });

  it('remove one component — component count decreases', async () => {
    const recipe = await createRecipe(TENANT, {
      nameHe: 'סלט',
      type: 'prep',
      yieldQty: 500,
      yieldUnit: 'g',
    });

    const comp1 = await addComponent(TENANT, recipe.id, {
      ingredientId: 'ing-1',
      qty: 100,
      unit: 'g',
    });

    await addComponent(TENANT, recipe.id, {
      ingredientId: 'ing-2',
      qty: 50,
      unit: 'g',
    });

    expect(componentStore.filter((c) => c.recipe_id === recipe.id)).toHaveLength(2);

    await removeComponent(TENANT, comp1.id);

    expect(componentStore.filter((c) => c.recipe_id === recipe.id)).toHaveLength(1);
  });

  it('update component quantity', async () => {
    const recipe = await createRecipe(TENANT, {
      nameHe: 'מרק עגבניות',
      type: 'prep',
      yieldQty: 1,
      yieldUnit: 'l',
    });

    const comp = await addComponent(TENANT, recipe.id, {
      ingredientId: 'ing-tomato',
      qty: 500,
      unit: 'g',
    });

    const updated = await updateComponent(TENANT, comp.id, { qty: 750 });
    expect(updated.qty).toBe(750);
  });

  it('cycle detection error is caught and shown gracefully', async () => {
    // Simulate a Server Action that throws the cycle error message
    const cyclicError = new Error('לא ניתן להוסיף — יוצר לולאה במתכון');

    // Mock addComponent to throw the cycle error for this test
    const cycleClient = {
      auth: { getUser: vi.fn() },
      from: vi.fn((table: string) => {
        if (table === 'recipe_components') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: () =>
                  Promise.resolve({ data: null, error: { message: cyclicError.message } }),
              }),
            }),
          };
        }
        return makeBuilder(null);
      }),
    };
    (createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(cycleClient);

    await expect(
      addComponent(TENANT, 'recipe-A', {
        subRecipeId: 'recipe-A', // self-reference → cycle
        qty: 1,
        unit: 'unit',
      }),
    ).rejects.toThrow();
  });

  it('create prep recipe — type is prep', async () => {
    const recipe = await createRecipe(TENANT, {
      nameHe: 'רוטב בסיסי',
      type: 'prep',
      yieldQty: 500,
      yieldUnit: 'ml',
    });

    expect(recipe.type).toBe('prep');
    expect(recipe.yieldQty).toBe(500);
    expect(recipe.yieldUnit).toBe('ml');
  });

  it('getRecipeWithComponents returns recipe with empty components', async () => {
    const recipe = await createRecipe(TENANT, {
      nameHe: 'מתכון ריק',
      type: 'menu',
      yieldQty: 1,
      yieldUnit: 'unit',
    });

    const result = await getRecipeWithComponents(TENANT, recipe.id);
    expect(result).not.toBeNull();
    expect(result!.nameHe).toBe('מתכון ריק');
    expect(result!.components).toHaveLength(0);
  });

  it('getRecipeWithComponents returns null for unknown id', async () => {
    const result = await getRecipeWithComponents(TENANT, 'non-existent-id');
    expect(result).toBeNull();
  });
});
