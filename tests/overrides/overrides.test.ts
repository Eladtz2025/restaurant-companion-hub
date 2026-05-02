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

// ── in-memory stores ────────────────────────────────────────────────────────
type OverrideRow = {
  id: string;
  tenant_id: string;
  entity_type: string;
  entity_id: string;
  field: string;
  original_value: unknown;
  override_value: unknown;
  reason: string | null;
  overridden_by: string;
  reverted: boolean;
  reverted_by: string | null;
  reverted_at: string | null;
  created_at: string;
};

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

let overrideStore: OverrideRow[] = [];
let prepTaskStore: PrepTaskRow[] = [];
let idSeq = 0;

function makeId() {
  return `aaaaaaaa-aaaa-4aaa-8aaa-${String(++idSeq).padStart(12, 'a')}`;
}

const TENANT = 'tenant-1';
const ENTITY_ID = 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
  getAuthContext: vi
    .fn()
    .mockResolvedValue({ userId: 'user-1', tenantId: 'tenant-1', role: 'manager' }),
}));

import { createServerSupabaseClient } from '@/lib/supabase/server';

// ── chainable query builder for manager_overrides ──────────────────────────
function buildOverrideChain(initialRows: OverrideRow[]) {
  let filtered = [...initialRows];
  const chain: Record<string, unknown> = {};

  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockImplementation((col: string, val: unknown) => {
    filtered = filtered.filter((r) => (r as Record<string, unknown>)[col] === val);
    return chain;
  });
  chain.order = vi.fn().mockImplementation(() => Promise.resolve({ data: filtered, error: null }));
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
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === 'manager_overrides') {
        return {
          select: vi.fn().mockImplementation(() => {
            const chain = buildOverrideChain(overrideStore);
            return chain;
          }),
          insert: vi.fn().mockImplementation((data: Partial<OverrideRow>) => {
            const row: OverrideRow = {
              id: makeId(),
              tenant_id: data.tenant_id ?? TENANT,
              entity_type: data.entity_type ?? 'prep_task',
              entity_id: data.entity_id ?? '',
              field: data.field ?? '',
              original_value: data.original_value ?? null,
              override_value: data.override_value ?? null,
              reason: data.reason ?? null,
              overridden_by: data.overridden_by ?? 'user-1',
              reverted: false,
              reverted_by: null,
              reverted_at: null,
              created_at: new Date().toISOString(),
            };
            overrideStore.push(row);
            return {
              select: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: row, error: null }),
              }),
            };
          }),
          update: vi.fn().mockImplementation((patch: Partial<OverrideRow>) => {
            const chain: Record<string, unknown> = {};
            chain.eq = vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((_col: string, id: string) => ({
                select: vi.fn().mockReturnValue({
                  single: () => {
                    const idx = overrideStore.findIndex((r) => r.id === id);
                    if (idx !== -1) Object.assign(overrideStore[idx]!, patch);
                    const row = overrideStore[idx] ?? null;
                    return Promise.resolve({
                      data: row,
                      error: row ? null : { message: 'Not found' },
                    });
                  },
                }),
              })),
            });
            return chain;
          }),
        };
      }

      if (table === 'prep_tasks') {
        return {
          select: vi.fn().mockImplementation(() => {
            let filtered = [...prepTaskStore];
            const chain: Record<string, unknown> = {};
            chain.eq = vi.fn().mockImplementation((col: string, val: unknown) => {
              filtered = filtered.filter((r) => (r as Record<string, unknown>)[col] === val);
              return chain;
            });
            chain.order = vi.fn().mockReturnValue(Promise.resolve({ data: filtered, error: null }));
            chain.single = vi.fn().mockImplementation(() => {
              const row = filtered[0] ?? null;
              return Promise.resolve({ data: row, error: row ? null : { message: 'Not found' } });
            });
            return chain;
          }),
          insert: vi.fn().mockImplementation((data: Partial<PrepTaskRow>) => {
            const row: PrepTaskRow = {
              id: makeId(),
              tenant_id: data.tenant_id ?? TENANT,
              recipe_id: data.recipe_id ?? '',
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
            prepTaskStore.push(row);
            return {
              select: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: row, error: null }),
              }),
            };
          }),
          update: vi.fn().mockImplementation((patch: Partial<PrepTaskRow>) => {
            const chain: Record<string, unknown> = {};
            chain.eq = vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((_col: string, id: string) => {
                const idx = prepTaskStore.findIndex((r) => r.id === id);
                if (idx !== -1) Object.assign(prepTaskStore[idx]!, patch);
                return Promise.resolve({ data: null, error: null });
              }),
            });
            return chain;
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((_col: string, id: string) => {
                prepTaskStore = prepTaskStore.filter((r) => r.id !== id);
                return Promise.resolve({ data: null, error: null });
              }),
            }),
          }),
        };
      }

      return {
        select: vi.fn().mockReturnValue(Promise.resolve({ data: [], error: null })),
      };
    }),
  };
  (createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);
}

// ── import actions after mocks are registered ─────────────────────────────
const { createOverride, revertOverride, getOverrides } = await import('@/lib/actions/overrides');

describe('Manager Overrides', () => {
  beforeEach(() => {
    overrideStore = [];
    prepTaskStore = [];
    idSeq = 0;
    mockSupabase();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('getOverrides returns empty array for fresh tenant', async () => {
    const result = await getOverrides(TENANT);
    expect(result).toHaveLength(0);
  });

  it('createOverride creates override and records original/override values', async () => {
    const override = await createOverride(TENANT, {
      entityType: 'prep_task',
      entityId: ENTITY_ID,
      field: 'qty_required',
      originalValue: 10,
      overrideValue: 15,
      reason: 'Weekend rush',
    });

    expect(override.entityType).toBe('prep_task');
    expect(override.entityId).toBe(ENTITY_ID);
    expect(override.field).toBe('qty_required');
    expect(override.originalValue).toBe(10);
    expect(override.overrideValue).toBe(15);
    expect(override.reason).toBe('Weekend rush');
    expect(override.overriddenBy).toBe('user-1');
    expect(override.reverted).toBe(false);
  });

  it('createOverride applies override to prep_task qty_required', async () => {
    // Seed a prep task
    const taskId = makeId();
    prepTaskStore.push({
      id: taskId,
      tenant_id: TENANT,
      recipe_id: 'recipe-1',
      prep_date: '2026-05-02',
      qty_required: 10,
      qty_actual: null,
      unit: 'kg',
      status: 'pending',
      notes: null,
      assigned_to: null,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await createOverride(TENANT, {
      entityType: 'prep_task',
      entityId: taskId,
      field: 'qty_required',
      originalValue: 10,
      overrideValue: 20,
    });

    const updated = prepTaskStore.find((t) => t.id === taskId);
    expect(updated?.qty_required).toBe(20);
  });

  it('createOverride throws ZodError if entityId is not a valid UUID', async () => {
    await expect(
      createOverride(TENANT, {
        entityType: 'prep_task',
        entityId: 'not-a-uuid',
        field: 'qty_required',
        originalValue: 5,
        overrideValue: 10,
      }),
    ).rejects.toThrow();
  });

  it('revertOverride restores original value and marks as reverted', async () => {
    // Seed a prep task
    const taskId = makeId();
    prepTaskStore.push({
      id: taskId,
      tenant_id: TENANT,
      recipe_id: 'recipe-1',
      prep_date: '2026-05-02',
      qty_required: 20,
      qty_actual: null,
      unit: 'kg',
      status: 'pending',
      notes: null,
      assigned_to: null,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const override = await createOverride(TENANT, {
      entityType: 'prep_task',
      entityId: taskId,
      field: 'qty_required',
      originalValue: 10,
      overrideValue: 20,
    });

    const reverted = await revertOverride(TENANT, override.id);

    expect(reverted.reverted).toBe(true);
    expect(reverted.revertedBy).toBe('user-1');
    expect(reverted.revertedAt).not.toBeNull();

    const restored = prepTaskStore.find((t) => t.id === taskId);
    expect(restored?.qty_required).toBe(10);
  });

  it('revertOverride throws if override is already reverted', async () => {
    const taskId = makeId();
    prepTaskStore.push({
      id: taskId,
      tenant_id: TENANT,
      recipe_id: 'recipe-1',
      prep_date: '2026-05-02',
      qty_required: 20,
      qty_actual: null,
      unit: 'kg',
      status: 'pending',
      notes: null,
      assigned_to: null,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const override = await createOverride(TENANT, {
      entityType: 'prep_task',
      entityId: taskId,
      field: 'qty_required',
      originalValue: 10,
      overrideValue: 20,
    });

    await revertOverride(TENANT, override.id);

    await expect(revertOverride(TENANT, override.id)).rejects.toThrow('Override already reverted');
  });

  it('getOverrides excludes reverted overrides by default', async () => {
    const taskId = makeId();
    prepTaskStore.push({
      id: taskId,
      tenant_id: TENANT,
      recipe_id: 'recipe-1',
      prep_date: '2026-05-02',
      qty_required: 10,
      qty_actual: null,
      unit: 'kg',
      status: 'pending',
      notes: null,
      assigned_to: null,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const override = await createOverride(TENANT, {
      entityType: 'prep_task',
      entityId: taskId,
      field: 'qty_required',
      originalValue: 10,
      overrideValue: 15,
    });

    await revertOverride(TENANT, override.id);

    const result = await getOverrides(TENANT);
    expect(result.every((o) => !o.reverted)).toBe(true);
    expect(result.find((o) => o.id === override.id)).toBeUndefined();
  });

  it('getOverrides includes reverted overrides when includeReverted is true', async () => {
    const taskId1 = makeId();
    const taskId2 = makeId();

    prepTaskStore.push(
      {
        id: taskId1,
        tenant_id: TENANT,
        recipe_id: 'recipe-1',
        prep_date: '2026-05-02',
        qty_required: 10,
        qty_actual: null,
        unit: 'kg',
        status: 'pending',
        notes: null,
        assigned_to: null,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: taskId2,
        tenant_id: TENANT,
        recipe_id: 'recipe-2',
        prep_date: '2026-05-02',
        qty_required: 5,
        qty_actual: null,
        unit: 'kg',
        status: 'pending',
        notes: null,
        assigned_to: null,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    );

    const override1 = await createOverride(TENANT, {
      entityType: 'prep_task',
      entityId: taskId1,
      field: 'qty_required',
      originalValue: 10,
      overrideValue: 15,
    });

    await createOverride(TENANT, {
      entityType: 'prep_task',
      entityId: taskId2,
      field: 'qty_required',
      originalValue: 5,
      overrideValue: 8,
    });

    await revertOverride(TENANT, override1.id);

    const allOverrides = await getOverrides(TENANT, { includeReverted: true });
    expect(allOverrides).toHaveLength(2);
    expect(allOverrides.some((o) => o.reverted)).toBe(true);
    expect(allOverrides.some((o) => !o.reverted)).toBe(true);
  });
});
