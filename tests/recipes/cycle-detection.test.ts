import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn(() => ({ getAll: () => [] })) }));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'recipe_components') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          then: vi.fn(),
          // Simulate async query
          [Symbol.asyncIterator]: undefined,
        };
      }
      return {};
    }),
  })),
  getAuthContext: vi.fn(() => null),
}));

// Pure cycle detection logic (extracted for unit testing without DB)
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
    const adj = new Map<string, string[]>();
    expect(detectCyclePure('A', 'B', adj)).toBe(false);
  });

  it('returns false for unrelated chain A→B→C, checking X→B', () => {
    const adj = new Map([['B', ['C']]]);
    expect(detectCyclePure('X', 'B', adj)).toBe(false);
  });

  it('detects direct self-reference: A uses A as sub-recipe', () => {
    const adj = new Map<string, string[]>();
    // Candidate is A itself — checking if A can reach A
    expect(detectCyclePure('A', 'A', adj)).toBe(true);
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
    // Adding B to A — no cycle
    expect(detectCyclePure('A', 'B', adj)).toBe(false);
    expect(detectCyclePure('A', 'C', adj)).toBe(false);
  });

  it('detects two-step cycle: A→B, B→A (adding B to A)', () => {
    const adj = new Map([['B', ['A']]]);
    expect(detectCyclePure('A', 'B', adj)).toBe(true);
  });
});
