import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn(() => ({ getAll: () => [] })) }));

// Adjacency map used by the mocked Supabase — tests set this before each detectCycle call
let mockAdjacency: Map<string, string[]> = new Map();

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn().mockImplementation(async () => ({
    from: vi.fn().mockImplementation((table: string) => {
      if (table !== 'recipe_components') return {};

      // Each call to .from() gets its own builder so recipe_id can be captured per query
      let capturedRecipeId: string | null = null;

      const builder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((_col: string, val: string) => {
          if (_col === 'recipe_id') capturedRecipeId = val;
          return builder;
        }),
        not: vi.fn().mockImplementation(() => {
          const children = capturedRecipeId ? (mockAdjacency.get(capturedRecipeId) ?? []) : [];
          return Promise.resolve({
            data: children.map((id) => ({ sub_recipe_id: id })),
            error: null,
          });
        }),
      };

      return builder;
    }),
  })),
  getAuthContext: vi.fn(() => null),
}));

// ── Pure BFS (logic verification without DB) ────────────────────────────────

function detectCyclePure(
  recipeId: string,
  candidateSubRecipeId: string,
  adjacency: Map<string, string[]>,
): boolean {
  const visited = new Set<string>();
  const queue = [candidateSubRecipeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === recipeId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const children = adjacency.get(current) ?? [];
    queue.push(...children);
  }
  return false;
}

describe('detectCycle (pure BFS)', () => {
  it('returns false when no sub-recipes exist', () => {
    expect(detectCyclePure('A', 'B', new Map())).toBe(false);
  });

  it('returns false for unrelated chain A→B→C, checking X→B', () => {
    expect(detectCyclePure('X', 'B', new Map([['B', ['C']]]))).toBe(false);
  });

  it('detects direct self-reference: A uses A as sub-recipe', () => {
    expect(detectCyclePure('A', 'A', new Map())).toBe(true);
  });

  it('detects indirect cycle: A→B→C→A', () => {
    const adj = new Map([
      ['B', ['C']],
      ['C', ['A']],
    ]);
    expect(detectCyclePure('A', 'B', adj)).toBe(true);
  });

  it('returns false for deep valid chain: A uses B, B uses C, C uses D', () => {
    const adj = new Map([
      ['B', ['C']],
      ['C', ['D']],
    ]);
    expect(detectCyclePure('A', 'B', adj)).toBe(false);
  });

  it('handles diamond dependency without cycle: A→B→D, A→C→D', () => {
    const adj = new Map([
      ['B', ['D']],
      ['C', ['D']],
    ]);
    expect(detectCyclePure('A', 'B', adj)).toBe(false);
    expect(detectCyclePure('A', 'C', adj)).toBe(false);
  });

  it('detects two-step cycle: A→B, B→A (adding B to A)', () => {
    expect(detectCyclePure('A', 'B', new Map([['B', ['A']]]))).toBe(true);
  });
});

// ── Actual detectCycle from recipes.ts (with mocked Supabase) ───────────────

const { detectCycle } = await import('@/lib/actions/recipes');

const TENANT = 'tenant-1';

describe('detectCycle (actual implementation, mocked DB)', () => {
  it('returns false when candidate has no sub-recipe links', async () => {
    mockAdjacency = new Map();
    expect(await detectCycle(TENANT, 'recipe-A', 'recipe-B')).toBe(false);
  });

  it('returns true for direct self-reference (A → A)', async () => {
    mockAdjacency = new Map();
    expect(await detectCycle(TENANT, 'recipe-A', 'recipe-A')).toBe(true);
  });

  it('returns true for two-step cycle: A → B → A', async () => {
    mockAdjacency = new Map([['recipe-B', ['recipe-A']]]);
    expect(await detectCycle(TENANT, 'recipe-A', 'recipe-B')).toBe(true);
  });

  it('returns true for three-step cycle: A → B → C → A', async () => {
    mockAdjacency = new Map([
      ['recipe-B', ['recipe-C']],
      ['recipe-C', ['recipe-A']],
    ]);
    expect(await detectCycle(TENANT, 'recipe-A', 'recipe-B')).toBe(true);
  });

  it('returns false for valid chain: A uses B, B uses C (no cycle)', async () => {
    mockAdjacency = new Map([['recipe-B', ['recipe-C']]]);
    expect(await detectCycle(TENANT, 'recipe-A', 'recipe-B')).toBe(false);
  });
});
