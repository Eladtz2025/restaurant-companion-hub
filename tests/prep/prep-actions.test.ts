import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll: () => [],
    set: vi.fn(),
    get: vi.fn(),
  }),
}));

vi.mock('@/lib/audit/logger', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

type PrepTaskRow = {
  id: string;
  tenant_id: string;
  recipe_id: string;
  prep_date: string;
  qty_required: number;
  qty_actual: number | null;
  unit: string;
  status: string;
  notes: string | null;
  assigned_to: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

let prepTasks: PrepTaskRow[] = [];
let idSeq = 0;

const TENANT = '11111111-1111-1111-8111-111111111111';
const RECIPE_ID = '22222222-2222-2222-8222-222222222222';
const RECIPE_ID_2 = '33333333-3333-3333-8333-333333333333';

function makeId() {
  return `aaaaaaaa-${String(++idSeq).padStart(4, '0')}-aaaa-8aaa-aaaaaaaaaaaa`;
}

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
  getAuthContext: vi
    .fn()
    .mockResolvedValue({
      userId: 'user-1',
      tenantId: '11111111-1111-1111-8111-111111111111',
      role: 'owner',
    }),
}));

import { createServerSupabaseClient } from '@/lib/supabase/server';

function buildSelectChain(rows: PrepTaskRow[]) {
  let filtered = [...rows];
  const chain: Record<string, unknown> = {};

  chain.eq = vi.fn().mockImplementation((col: string, val: unknown) => {
    filtered = filtered.filter((r) => (r as Record<string, unknown>)[col] === val);
    return chain;
  });

  chain.order = vi.fn().mockReturnValue(Promise.resolve({ data: filtered, error: null }));

  chain.single = vi.fn().mockImplementation(() => {
    const row = filtered[0] ?? null;
    return Promise.resolve({
      data: row,
      error: row ? null : { message: 'Not found' },
    });
  });

  return chain;
}

function mockSupabase() {
  const client = {
    from: vi.fn((table: string) => {
      if (table === 'prep_tasks') {
        return {
          select: vi.fn().mockImplementation(() => buildSelectChain(prepTasks)),

          insert: vi.fn().mockImplementation((data: Partial<PrepTaskRow>) => {
            const row: PrepTaskRow = {
              id: makeId(),
              tenant_id: data.tenant_id ?? TENANT,
              recipe_id: data.recipe_id ?? RECIPE_ID,
              prep_date: data.prep_date ?? '2026-05-02',
              qty_required: data.qty_required ?? 0,
              qty_actual: data.qty_actual ?? null,
              unit: data.unit ?? 'unit',
              status: data.status ?? 'pending',
              notes: data.notes ?? null,
              assigned_to: data.assigned_to ?? null,
              completed_at: data.completed_at ?? null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            prepTasks.push(row);
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: row, error: null }),
              }),
            };
          }),

          update: vi.fn().mockImplementation((patch: Partial<PrepTaskRow>) => {
            const chain = {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockImplementation((_col2: string, val2: unknown) => {
                  const taskIdx = prepTasks.findIndex((r) => r.id === val2);
                  if (taskIdx !== -1) Object.assign(prepTasks[taskIdx]!, patch);
                  const row = prepTasks[taskIdx] ?? null;
                  return {
                    select: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: row,
                        error: row ? null : { message: 'Not found' },
                      }),
                    }),
                  };
                }),
              }),
            };
            return chain;
          }),

          upsert: vi.fn().mockImplementation((rows: Partial<PrepTaskRow>[]) => {
            const inserted: PrepTaskRow[] = [];
            for (const data of rows) {
              const existing = prepTasks.find(
                (r) =>
                  r.tenant_id === data.tenant_id &&
                  r.recipe_id === data.recipe_id &&
                  r.prep_date === data.prep_date,
              );
              if (!existing) {
                const row: PrepTaskRow = {
                  id: makeId(),
                  tenant_id: data.tenant_id ?? TENANT,
                  recipe_id: data.recipe_id ?? RECIPE_ID,
                  prep_date: data.prep_date ?? '2026-05-02',
                  qty_required: data.qty_required ?? 0,
                  qty_actual: null,
                  unit: data.unit ?? 'unit',
                  status: 'pending',
                  notes: null,
                  assigned_to: null,
                  completed_at: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                prepTasks.push(row);
                inserted.push(row);
              }
            }
            return {
              select: vi.fn().mockResolvedValue({ data: inserted, error: null }),
            };
          }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }),
  };
  (createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);
}

const {
  getPrepTasksForDate,
  createPrepTask,
  updatePrepTaskStatus,
  bulkCreatePrepTasks,
  getPrepSummary,
} = await import('@/lib/actions/prep');

describe('Prep Actions', () => {
  beforeEach(() => {
    prepTasks = [];
    idSeq = 0;
    mockSupabase();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('getPrepTasksForDate — returns empty array for fresh tenant', async () => {
    const result = await getPrepTasksForDate(TENANT, '2026-05-02');
    expect(result).toHaveLength(0);
  });

  it('createPrepTask — creates and returns a task with correct fields', async () => {
    const task = await createPrepTask(TENANT, {
      recipeId: RECIPE_ID,
      prepDate: '2026-05-02',
      qtyRequired: 10,
      unit: 'kg',
    });

    expect(task.tenantId).toBe(TENANT);
    expect(task.recipeId).toBe(RECIPE_ID);
    expect(task.prepDate).toBe('2026-05-02');
    expect(task.qtyRequired).toBe(10);
    expect(task.unit).toBe('kg');
    expect(task.status).toBe('pending');
    expect(task.completedAt).toBeNull();
  });

  it('createPrepTask — throws ZodError when recipeId is not a UUID', async () => {
    await expect(
      createPrepTask(TENANT, {
        recipeId: 'not-a-uuid',
        prepDate: '2026-05-02',
        qtyRequired: 5,
        unit: 'unit',
      }),
    ).rejects.toThrow();
  });

  it('createPrepTask — throws ZodError when prepDate format is invalid', async () => {
    await expect(
      createPrepTask(TENANT, {
        recipeId: RECIPE_ID,
        prepDate: '02-05-2026',
        qtyRequired: 5,
        unit: 'unit',
      }),
    ).rejects.toThrow();
  });

  it('updatePrepTaskStatus — changes status to done and sets completedAt', async () => {
    const created = await createPrepTask(TENANT, {
      recipeId: RECIPE_ID,
      prepDate: '2026-05-02',
      qtyRequired: 8,
      unit: 'unit',
    });

    // Re-mock so update sets completed_at on the in-memory row before returning
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'prep_tasks') {
          return {
            select: vi.fn().mockImplementation(() => buildSelectChain(prepTasks)),
            insert: vi.fn(),
            update: vi.fn().mockImplementation((patch: Partial<PrepTaskRow>) => ({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockImplementation((_col2: string, val2: unknown) => {
                  const i = prepTasks.findIndex((r) => r.id === val2);
                  if (i !== -1) Object.assign(prepTasks[i]!, patch);
                  const row = prepTasks[i] ?? null;
                  return {
                    select: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: row,
                        error: row ? null : { message: 'Not found' },
                      }),
                    }),
                  };
                }),
              }),
            })),
            upsert: vi.fn(),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }),
    };
    (createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const updated = await updatePrepTaskStatus(TENANT, created.id, {
      status: 'done',
      qtyActual: 8,
    });

    expect(updated.status).toBe('done');
    expect(updated.completedAt).not.toBeNull();
    expect(updated.qtyActual).toBe(8);
  });

  it('updatePrepTaskStatus — rejects invalid status', async () => {
    const created = await createPrepTask(TENANT, {
      recipeId: RECIPE_ID,
      prepDate: '2026-05-02',
      qtyRequired: 5,
      unit: 'unit',
    });

    await expect(
      updatePrepTaskStatus(TENANT, created.id, {
        // @ts-expect-error intentionally passing invalid status
        status: 'invalid_status',
      }),
    ).rejects.toThrow();
  });

  it('bulkCreatePrepTasks — creates multiple tasks and returns them', async () => {
    const result = await bulkCreatePrepTasks(TENANT, [
      { recipeId: RECIPE_ID, prepDate: '2026-05-03', qtyRequired: 5, unit: 'kg' },
      { recipeId: RECIPE_ID_2, prepDate: '2026-05-03', qtyRequired: 12, unit: 'unit' },
    ]);

    expect(result).toHaveLength(2);
    expect(prepTasks).toHaveLength(2);
  });

  it('getPrepSummary — returns correct counts', async () => {
    await createPrepTask(TENANT, {
      recipeId: RECIPE_ID,
      prepDate: '2026-05-04',
      qtyRequired: 1,
      unit: 'unit',
    });
    await createPrepTask(TENANT, {
      recipeId: RECIPE_ID_2,
      prepDate: '2026-05-04',
      qtyRequired: 2,
      unit: 'unit',
    });

    // Manually set one task to done
    prepTasks[1]!.status = 'done';

    const summary = await getPrepSummary(TENANT, '2026-05-04');

    expect(summary.date).toBe('2026-05-04');
    expect(summary.total).toBe(2);
    expect(summary.pending).toBe(1);
    expect(summary.done).toBe(1);
    expect(summary.inProgress).toBe(0);
    expect(summary.skipped).toBe(0);
  });
});
