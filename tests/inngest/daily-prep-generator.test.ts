import { describe, expect, it } from 'vitest';

import { generateDailyPrepTasks } from '@/lib/prep/daily-generator';

const TARGET_DATE = '2026-05-03';
const RECIPE_A = 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa';
const RECIPE_B = 'bbbbbbbb-bbbb-bbbb-8bbb-bbbbbbbbbbbb';
const RECIPE_C = 'cccccccc-cccc-cccc-8ccc-cccccccccccc';

function makeHistory(
  entries: Array<{ recipeId: string; points: Array<{ date: string; qty: number }> }>,
): Map<string, Array<{ date: string; qty: number }>> {
  return new Map(entries.map((e) => [e.recipeId, e.points]));
}

describe('generateDailyPrepTasks — inngest integration', () => {
  it('returns empty tasks and skipped when no recipes are provided', () => {
    const result = generateDailyPrepTasks({
      tenantId: 'tenant-x',
      targetDate: TARGET_DATE,
      salesHistory: new Map(),
      recipeUnits: new Map(),
    });
    expect(result.tasks).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it('applies 15% buffer (ceil) for a recipe with 3 data points', () => {
    // avg = (10 + 20 + 30) / 3 = 20, ceil(20 * 1.15) = ceil(23) = 23
    const history = makeHistory([
      {
        recipeId: RECIPE_A,
        points: [
          { date: '2026-04-30', qty: 10 },
          { date: '2026-05-01', qty: 20 },
          { date: '2026-05-02', qty: 30 },
        ],
      },
    ]);

    const result = generateDailyPrepTasks({
      tenantId: 'tenant-x',
      targetDate: TARGET_DATE,
      salesHistory: history,
      recipeUnits: new Map([[RECIPE_A, 'kg']]),
    });

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]!.qtyRequired).toBe(23);
    expect(result.tasks[0]!.unit).toBe('kg');
  });

  it('adds recipe to skipped when it has no history points', () => {
    // Empty points array → skipped by generator
    const history = makeHistory([{ recipeId: RECIPE_A, points: [] }]);

    const result = generateDailyPrepTasks({
      tenantId: 'tenant-x',
      targetDate: TARGET_DATE,
      salesHistory: history,
      recipeUnits: new Map([[RECIPE_A, 'unit']]),
    });

    expect(result.tasks).toHaveLength(0);
    expect(result.skipped).toContain(RECIPE_A);
  });

  it('handles multiple recipes: some with history produce tasks, others are skipped', () => {
    const history = makeHistory([
      {
        recipeId: RECIPE_A,
        points: [
          { date: '2026-04-30', qty: 8 },
          { date: '2026-05-01', qty: 8 },
        ],
      },
      // RECIPE_B has no history → skipped
      { recipeId: RECIPE_B, points: [] },
      {
        recipeId: RECIPE_C,
        points: [{ date: '2026-05-01', qty: 5 }],
      },
    ]);

    const result = generateDailyPrepTasks({
      tenantId: 'tenant-x',
      targetDate: TARGET_DATE,
      salesHistory: history,
      recipeUnits: new Map([
        [RECIPE_A, 'kg'],
        [RECIPE_B, 'unit'],
        [RECIPE_C, 'portion'],
      ]),
    });

    // RECIPE_A and RECIPE_C produce tasks; RECIPE_B is skipped
    expect(result.tasks).toHaveLength(2);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped).toContain(RECIPE_B);
  });

  it('applies ceil(avg * 1.15) buffer correctly for 7+ data points', () => {
    // 7 points all qty=10 → avg=10, ceil(10 * 1.15) = ceil(11.5) = 12
    const points = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-04-${String(i + 20).padStart(2, '0')}`,
      qty: 10,
    }));

    const history = makeHistory([{ recipeId: RECIPE_A, points }]);

    const result = generateDailyPrepTasks({
      tenantId: 'tenant-x',
      targetDate: TARGET_DATE,
      salesHistory: history,
      recipeUnits: new Map([[RECIPE_A, 'unit']]),
    });

    expect(result.tasks).toHaveLength(1);
    // ceil(10 * 1.15) = ceil(11.5) = 12
    expect(result.tasks[0]!.qtyRequired).toBe(12);
    // Verify targetDate is propagated correctly as YYYY-MM-DD
    expect(result.tasks[0]!.prepDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.tasks[0]!.prepDate).toBe(TARGET_DATE);
  });
});
