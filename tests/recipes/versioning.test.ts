/**
 * Recipe versioning integration tests.
 *
 * Tests saveRecipeVersion, getRecipeVersions, and restoreRecipeVersion
 * using in-memory stores and a mocked Supabase client.
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

// ── mock the audit logger ─────────────────────────────────────────────────
vi.mock('@/lib/audit/logger', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

// ── in-memory stores ──────────────────────────────────────────────────────
type RecipeRow = {
  id: string;
  tenant_id: string;
  name_he: string;
  name_en: string | null;
  type: string;
  yield_qty: number;
  yield_unit: string;
  active: boolean;
  current_version: number;
  image_url: string | null;
  instructions_md: string | null;
  video_url: string | null;
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

type VersionRow = {
  id: string;
  tenant_id: string;
  recipe_id: string;
  version: number;
  snapshot_data: unknown;
  changed_by: string | null;
  change_note: string | null;
  created_at: string;
};

let recipes: RecipeRow[] = [];
let components: ComponentRow[] = [];
let versions: VersionRow[] = [];
let versionIdSeq = 0;
let componentIdSeq = 0;

const TENANT = '11111111-1111-1111-8111-111111111111';
const RECIPE_ID = '22222222-2222-2222-8222-222222222222';
const COMPONENT_ID_1 = '33333333-3333-3333-8333-333333333333';
const INGREDIENT_ID = '44444444-4444-4444-8444-444444444444';

function makeVersionId() {
  return `55555555-${String(++versionIdSeq).padStart(4, '0')}-5555-8555-555555555555`;
}

function makeComponentId() {
  return `66666666-${String(++componentIdSeq).padStart(4, '0')}-6666-8666-666666666666`;
}

// ── Supabase mock ─────────────────────────────────────────────────────────
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
  getAuthContext: vi
    .fn()
    .mockResolvedValue({ userId: 'user-1', tenantId: '11111111-1111-1111-8111-111111111111', role: 'owner' }),
}));

import { createServerSupabaseClient } from '@/lib/supabase/server';

function mockSupabase() {
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === 'recipes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col1: string, val1: string) => ({
              eq: vi.fn().mockImplementation((col2: string, val2: string) => ({
                single: () => {
                  const row = recipes.find(
                    (r) =>
                      (r as Record<string, unknown>)[col1] === val1 &&
                      (r as Record<string, unknown>)[col2] === val2,
                  );
                  return Promise.resolve({
                    data: row ?? null,
                    error: row ? null : { code: 'PGRST116', message: 'Not found' },
                  });
                },
              })),
              order: vi.fn().mockReturnValue(
                Promise.resolve({
                  data: recipes.filter((r) => (r as Record<string, unknown>)[col1] === val1),
                  error: null,
                }),
              ),
            })),
          }),
          update: vi.fn().mockImplementation((patch: Partial<RecipeRow>) => ({
            eq: vi.fn().mockImplementation((_col1: string, _val1: string) => ({
              eq: vi.fn().mockImplementation((_col2: string, val2: string) => {
                const idx = recipes.findIndex((r) => r.id === val2);
                if (idx !== -1) Object.assign(recipes[idx]!, patch);
                return Promise.resolve({ data: recipes[idx] ?? null, error: null });
              }),
            })),
          })),
        };
      }

      if (table === 'recipe_components') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col1: string, val1: string) => ({
              eq: vi.fn().mockImplementation((col2: string, val2: string) => ({
                order: vi.fn().mockReturnValue(
                  Promise.resolve({
                    data: components.filter(
                      (c) =>
                        (c as Record<string, unknown>)[col1] === val1 &&
                        (c as Record<string, unknown>)[col2] === val2,
                    ),
                    error: null,
                  }),
                ),
              })),
            })),
          }),
          insert: vi.fn().mockImplementation((rows: Partial<ComponentRow> | Partial<ComponentRow>[]) => {
            const arr = Array.isArray(rows) ? rows : [rows];
            const inserted = arr.map((r) => ({
              id: makeComponentId(),
              tenant_id: r.tenant_id ?? TENANT,
              recipe_id: r.recipe_id ?? RECIPE_ID,
              ingredient_id: r.ingredient_id ?? null,
              sub_recipe_id: r.sub_recipe_id ?? null,
              qty: r.qty ?? 1,
              unit: r.unit ?? 'unit',
              sort_order: r.sort_order ?? 0,
              created_at: new Date().toISOString(),
            }));
            components.push(...inserted);
            return Promise.resolve({ data: inserted, error: null });
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col1: string, val1: string) => ({
              eq: vi.fn().mockImplementation((col2: string, val2: string) => {
                components = components.filter(
                  (c) =>
                    !((c as Record<string, unknown>)[col1] === val1 &&
                      (c as Record<string, unknown>)[col2] === val2),
                );
                return Promise.resolve({ data: null, error: null });
              }),
            })),
          }),
        };
      }

      if (table === 'recipe_versions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col1: string, val1: string) => ({
              eq: vi.fn().mockImplementation((col2: string, val2: string) => ({
                eq: vi.fn().mockImplementation((col3: string, val3: unknown) => ({
                  single: () => {
                    const row = versions.find(
                      (v) =>
                        (v as Record<string, unknown>)[col1] === val1 &&
                        (v as Record<string, unknown>)[col2] === val2 &&
                        (v as Record<string, unknown>)[col3] === val3,
                    );
                    return Promise.resolve({
                      data: row ?? null,
                      error: row ? null : { message: 'Not found' },
                    });
                  },
                })),
                order: vi.fn().mockReturnValue(
                  Promise.resolve({
                    data: [...versions]
                      .filter(
                        (v) =>
                          (v as Record<string, unknown>)[col1] === val1 &&
                          (v as Record<string, unknown>)[col2] === val2,
                      )
                      .sort((a, b) => b.version - a.version),
                    error: null,
                  }),
                ),
              })),
            })),
          }),
          insert: vi.fn().mockImplementation((data: Partial<VersionRow>) => {
            const row: VersionRow = {
              id: makeVersionId(),
              tenant_id: data.tenant_id ?? TENANT,
              recipe_id: data.recipe_id ?? RECIPE_ID,
              version: data.version ?? 1,
              snapshot_data: data.snapshot_data ?? {},
              changed_by: data.changed_by ?? null,
              change_note: data.change_note ?? null,
              created_at: new Date().toISOString(),
            };
            versions.push(row);
            return {
              select: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: row, error: null }),
              }),
            };
          }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnValue(Promise.resolve({ data: [], error: null })),
      };
    }),
  };
  (createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);
}

// ── import actions after mocks are registered ──────────────────────────────
const { saveRecipeVersion, getRecipeVersions, restoreRecipeVersion } = await import(
  '@/lib/actions/recipes'
);

// ── helpers ───────────────────────────────────────────────────────────────
function seedRecipe(overrides: Partial<RecipeRow> = {}): RecipeRow {
  const row: RecipeRow = {
    id: RECIPE_ID,
    tenant_id: TENANT,
    name_he: 'מרק עגבניות',
    name_en: null,
    type: 'menu',
    yield_qty: 4,
    yield_unit: 'unit',
    active: true,
    current_version: 1,
    image_url: null,
    instructions_md: null,
    video_url: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
  recipes.push(row);
  return row;
}

function seedComponent(overrides: Partial<ComponentRow> = {}): ComponentRow {
  const row: ComponentRow = {
    id: COMPONENT_ID_1,
    tenant_id: TENANT,
    recipe_id: RECIPE_ID,
    ingredient_id: INGREDIENT_ID,
    sub_recipe_id: null,
    qty: 500,
    unit: 'g',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
  components.push(row);
  return row;
}

// ── tests ─────────────────────────────────────────────────────────────────
describe('Recipe Versioning', () => {
  beforeEach(() => {
    recipes = [];
    components = [];
    versions = [];
    versionIdSeq = 0;
    componentIdSeq = 0;
    mockSupabase();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('saveRecipeVersion — creates a version with correct snapshot', async () => {
    seedRecipe();
    seedComponent();

    const ver = await saveRecipeVersion(TENANT, RECIPE_ID, 'initial save');

    expect(ver.recipeId).toBe(RECIPE_ID);
    expect(ver.tenantId).toBe(TENANT);
    expect(ver.version).toBe(1);
    expect(ver.changeNote).toBe('initial save');

    // snapshot should contain recipe + components
    const snapshot = ver.snapshotData;
    expect(snapshot.nameHe).toBe('מרק עגבניות');
    expect(snapshot.components).toHaveLength(1);
    expect(snapshot.components[0]!.ingredientId).toBe(INGREDIENT_ID);
    expect(snapshot.components[0]!.qty).toBe(500);
  });

  it('saveRecipeVersion — increments version number', async () => {
    seedRecipe({ current_version: 1 });
    seedComponent();

    await saveRecipeVersion(TENANT, RECIPE_ID, 'v1');

    // After save, recipe current_version should be incremented to 2
    const recipe = recipes.find((r) => r.id === RECIPE_ID)!;
    expect(recipe.current_version).toBe(2);

    // Second save uses version 2
    const ver2 = await saveRecipeVersion(TENANT, RECIPE_ID, 'v2');
    expect(ver2.version).toBe(2);
    expect(recipe.current_version).toBe(3);
  });

  it('getRecipeVersions — returns versions in descending order', async () => {
    seedRecipe({ current_version: 1 });
    seedComponent();

    await saveRecipeVersion(TENANT, RECIPE_ID, 'first');
    await saveRecipeVersion(TENANT, RECIPE_ID, 'second');
    await saveRecipeVersion(TENANT, RECIPE_ID, 'third');

    const result = await getRecipeVersions(TENANT, RECIPE_ID);

    expect(result).toHaveLength(3);
    // descending order: 3, 2, 1
    expect(result[0]!.version).toBe(3);
    expect(result[1]!.version).toBe(2);
    expect(result[2]!.version).toBe(1);
  });

  it('restoreRecipeVersion — restores components from snapshot', async () => {
    seedRecipe({ current_version: 1 });
    seedComponent({ qty: 200, unit: 'ml' });

    // Save version 1 with qty=200
    await saveRecipeVersion(TENANT, RECIPE_ID, 'original');

    // Simulate updating components (change qty by manipulating store)
    const comp = components.find((c) => c.recipe_id === RECIPE_ID)!;
    comp.qty = 999;

    // Restore version 1
    const restored = await restoreRecipeVersion(TENANT, RECIPE_ID, 1);

    // Restored components should reflect the snapshot (qty=200)
    expect(restored.components).toHaveLength(1);
    expect(restored.components[0]!.qty).toBe(200);
    expect(restored.components[0]!.unit).toBe('ml');
  });

  it('restoreRecipeVersion — creates a new version entry after restore', async () => {
    seedRecipe({ current_version: 1 });
    seedComponent();

    // Save initial version
    await saveRecipeVersion(TENANT, RECIPE_ID, 'initial');

    const versionsBeforeRestore = versions.length;

    // Restore version 1 — should create an additional version snapshot
    await restoreRecipeVersion(TENANT, RECIPE_ID, 1);

    expect(versions.length).toBeGreaterThan(versionsBeforeRestore);

    // The latest version should have a "Restored" change note
    const lastVersion = versions[versions.length - 1]!;
    expect(lastVersion.change_note).toContain('Restored');
  });

  it('getRecipeVersions — returns empty array when no versions exist', async () => {
    seedRecipe();

    const result = await getRecipeVersions(TENANT, RECIPE_ID);
    expect(result).toHaveLength(0);
  });
});
