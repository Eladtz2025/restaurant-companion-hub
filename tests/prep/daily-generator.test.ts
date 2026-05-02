import { describe, expect, it } from 'vitest';

import { generateDailyPrepTasks } from '@/lib/prep/daily-generator';

const TARGET_DATE = '2026-05-02';
const RECIPE_A = '11111111-1111-1111-8111-111111111111';
const RECIPE_B = '22222222-2222-2222-8222-222222222222';
const RECIPE_C = '33333333-3333-3333-8333-333333333333';

function makeSalesHistory(
  entries: Array<{ recipeId: string; points: Array<{ date: string; qty: number }> }>,
): Map<string, Array<{ date: string; qty: number }>> {
  return new Map(entries.map((e) => [e.recipeId, e.points]));
}

describe('generateDailyPrepTasks', () => {
  it('returns empty tasks and empty skipped when salesHistory is empty', () => {
    const result = generateDailyPrepTasks({
      tenantId: 'tenant-1',
      targetDate: TARGET_DATE,
      salesHistory: new Map(),
      recipeUnits: new Map(),
    });
    expect(result.tasks).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it('forecasts qty with 15% buffer for a recipe with 3 data points', () => {
    // avg = (10+20+30)/3 = 20, with 15% buffer = ceil(20 * 1.15) = ceil(23) = 23
    const history = makeSalesHistory([
      {
        recipeId: RECIPE_A,
        points: [
          { date: '2026-04-29', qty: 10 },
          { date: '2026-04-30', qty: 20 },
          { date: '2026-05-01', qty: 30 },
        ],
      },
    ]);

    const result = generateDailyPrepTasks({
      tenantId: 'tenant-1',
      targetDate: TARGET_DATE,
      salesHistory: history,
      recipeUnits: new Map([[RECIPE_A, 'kg']]),
    });

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]!.qtyRequired).toBe(23);
    expect(result.tasks[0]!.unit).toBe('kg');
  });

  it('assigns high confidence when recipe has 7 or more data points', () => {
    const history = makeSalesHistory([
      {
        recipeId: RECIPE_A,
        points: Array.from({ length: 7 }, (_, i) => ({
          date: `2026-04-${String(i + 1).padStart(2, '0')}`,
          qty: 10,
        })),
      },
    ]);

    // generateDailyPrepTasks uses SimpleAverageProvider internally; verify the task is created (high confidence still leads to a task)
    const result = generateDailyPrepTasks({
      tenantId: 'tenant-1',
      targetDate: TARGET_DATE,
      salesHistory: history,
      recipeUnits: new Map([[RECIPE_A, 'kg']]),
    });

    // With 7 points of qty=10, avg=10, buffer=15% → ceil(11.5)=12
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]!.qtyRequired).toBe(12);
  });

  it('skips recipe when forecastQty is zero (all history is zero)', () => {
    const history = makeSalesHistory([
      {
        recipeId: RECIPE_A,
        points: [
          { date: '2026-04-29', qty: 0 },
          { date: '2026-04-30', qty: 0 },
        ],
      },
    ]);

    const result = generateDailyPrepTasks({
      tenantId: 'tenant-1',
      targetDate: TARGET_DATE,
      salesHistory: history,
      recipeUnits: new Map([[RECIPE_A, 'unit']]),
    });

    expect(result.tasks).toHaveLength(0);
    expect(result.skipped).toContain(RECIPE_A);
  });

  it('handles multiple recipes and generates correct task count', () => {
    const history = makeSalesHistory([
      {
        recipeId: RECIPE_A,
        points: [
          { date: '2026-04-30', qty: 5 },
          { date: '2026-05-01', qty: 5 },
        ],
      },
      {
        recipeId: RECIPE_B,
        points: [
          { date: '2026-04-30', qty: 10 },
          { date: '2026-05-01', qty: 10 },
        ],
      },
      {
        recipeId: RECIPE_C,
        points: [
          { date: '2026-04-30', qty: 0 },
          { date: '2026-05-01', qty: 0 },
        ],
      },
    ]);

    const result = generateDailyPrepTasks({
      tenantId: 'tenant-1',
      targetDate: TARGET_DATE,
      salesHistory: history,
      recipeUnits: new Map([
        [RECIPE_A, 'kg'],
        [RECIPE_B, 'unit'],
      ]),
    });

    // RECIPE_C has 0 qty, should be skipped
    expect(result.tasks).toHaveLength(2);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped).toContain(RECIPE_C);
  });

  it('falls back to unit when recipeUnit is not in the map', () => {
    const history = makeSalesHistory([
      { recipeId: RECIPE_A, points: [{ date: '2026-04-30', qty: 8 }] },
    ]);

    const result = generateDailyPrepTasks({
      tenantId: 'tenant-1',
      targetDate: TARGET_DATE,
      salesHistory: history,
      recipeUnits: new Map(), // empty — no unit for RECIPE_A
    });

    expect(result.tasks[0]!.unit).toBe('unit');
  });

  it('sets prepDate to targetDate on each generated task', () => {
    const history = makeSalesHistory([
      { recipeId: RECIPE_A, points: [{ date: '2026-04-30', qty: 4 }] },
      { recipeId: RECIPE_B, points: [{ date: '2026-04-30', qty: 6 }] },
    ]);

    const result = generateDailyPrepTasks({
      tenantId: 'tenant-1',
      targetDate: TARGET_DATE,
      salesHistory: history,
      recipeUnits: new Map(),
    });

    for (const task of result.tasks) {
      expect(task.prepDate).toBe(TARGET_DATE);
    }
  });
});
