/**
 * Ingredients flow integration test.
 *
 * Tests the full create → list → update → delete cycle at the Server Action
 * layer using a mocked Supabase client. Playwright/browser E2E is deferred
 * until the preview environment is stable.
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

// ── in-memory ingredient store used by all mocked queries ─────────────────
type Row = {
  id: string;
  tenant_id: string;
  name_he: string;
  name_en: string | null;
  unit: string;
  category: string;
  cost_per_unit_cents: number;
  pkg_qty: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

let store: Row[] = [];
let idSeq = 0;

function makeRow(partial: Partial<Row>): Row {
  return {
    id: `id-${++idSeq}`,
    tenant_id: 'tenant-1',
    name_he: 'test',
    name_en: null,
    unit: 'kg',
    category: 'other',
    cost_per_unit_cents: 0,
    pkg_qty: null,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

// Minimal Supabase query builder mock
function makeBuilder(rows: Row[] | Row | null, error: null | { message: string } = null) {
  const result = { data: rows, error };
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.ilike = chain;
  builder.order = chain;
  builder.limit = chain;
  builder.single = () => Promise.resolve(result);
  builder.maybeSingle = () => Promise.resolve(result);
  builder.then = (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
  getAuthContext: vi
    .fn()
    .mockResolvedValue({ userId: 'user-1', tenantId: 'tenant-1', role: 'owner' }),
}));

import { createServerSupabaseClient } from '@/lib/supabase/server';

function mockSupabase() {
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table !== 'ingredients') return makeBuilder(null);

      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation((_col: string, val: string) => {
            const filtered = store.filter((r) => r.tenant_id === val);
            return {
              eq: vi.fn().mockReturnValue(makeBuilder(filtered[0] ?? null)),
              ilike: vi
                .fn()
                .mockReturnValue({ order: vi.fn().mockReturnValue(makeBuilder(filtered)) }),
              order: vi.fn().mockReturnValue(makeBuilder(filtered)),
            };
          }),
        }),
        insert: vi.fn().mockImplementation((data: Partial<Row>) => {
          const row = makeRow({ ...data, tenant_id: 'tenant-1' });
          store.push(row);
          return {
            select: vi
              .fn()
              .mockReturnValue({ single: () => Promise.resolve({ data: row, error: null }) }),
          };
        }),
        update: vi.fn().mockImplementation((patch: Partial<Row>) => ({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: () => {
                  const idx = store.findIndex((r) => r.tenant_id === 'tenant-1');
                  if (idx !== -1) Object.assign(store[idx]!, patch);
                  return Promise.resolve({ data: store[idx] ?? null, error: null });
                },
              }),
            }),
          }),
        })),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_col: string, id: string) => {
              store = store.filter((r) => r.id !== id);
              return Promise.resolve({ data: null, error: null });
            }),
          }),
        }),
      };
    }),
  };
  (createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);
}

// ── import actions after mocks are registered ─────────────────────────────
const { getIngredients, createIngredient, updateIngredient, deleteIngredient } =
  await import('@/lib/actions/ingredients');

const TENANT = 'tenant-1';

describe('Ingredients — full CRUD flow', () => {
  beforeEach(() => {
    store = [];
    idSeq = 0;
    mockSupabase();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('list is empty on fresh tenant', async () => {
    const result = await getIngredients(TENANT);
    expect('data' in result).toBe(true);
    if ('data' in result) expect(result.data).toHaveLength(0);
  });

  it('create ingredient — appears in list', async () => {
    await createIngredient(TENANT, {
      nameHe: 'עגבנייה',
      unit: 'kg',
      category: 'produce',
      costPerUnitCents: 450,
    });

    const result = await getIngredients(TENANT);
    expect('data' in result).toBe(true);
    if ('data' in result) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.nameHe).toBe('עגבנייה');
      expect(result.data[0]!.costPerUnitCents).toBe(450);
    }
  });

  it('create two ingredients — both appear', async () => {
    await createIngredient(TENANT, {
      nameHe: 'חלב',
      unit: 'l',
      category: 'dairy',
      costPerUnitCents: 600,
    });
    await createIngredient(TENANT, {
      nameHe: 'קמח',
      unit: 'g',
      category: 'dry',
      costPerUnitCents: 50,
    });

    const result = await getIngredients(TENANT);
    if ('data' in result) expect(result.data).toHaveLength(2);
  });

  it('update ingredient — change reflected', async () => {
    const created = await createIngredient(TENANT, {
      nameHe: 'שמן',
      unit: 'l',
      category: 'dry',
      costPerUnitCents: 1000,
    });
    if ('error' in created) throw new Error(created.error);

    await updateIngredient(TENANT, created.data.id, { costPerUnitCents: 1200 });

    const row = store.find((r) => r.id === created.data.id);
    expect(row?.cost_per_unit_cents).toBe(1200);
  });

  it('delete ingredient — removed from store', async () => {
    const created = await createIngredient(TENANT, {
      nameHe: 'פטרוזיליה',
      unit: 'unit',
      category: 'produce',
      costPerUnitCents: 100,
    });
    if ('error' in created) throw new Error(created.error);

    await deleteIngredient(TENANT, created.data.id);
    expect(store).toHaveLength(0);
  });

  it('create → delete → list is empty again', async () => {
    const created = await createIngredient(TENANT, {
      nameHe: 'ביצים',
      unit: 'pkg',
      category: 'other',
      costPerUnitCents: 2800,
      pkgQty: 12,
    });
    if ('error' in created) throw new Error(created.error);

    await deleteIngredient(TENANT, created.data.id);

    const result = await getIngredients(TENANT);
    if ('data' in result) expect(result.data).toHaveLength(0);
  });

  it('validation rejects empty name', async () => {
    const result = await createIngredient(TENANT, {
      nameHe: '',
      unit: 'kg',
      category: 'produce',
    });
    expect('error' in result).toBe(true);
  });

  it('validation rejects invalid unit', async () => {
    const result = await createIngredient(TENANT, {
      nameHe: 'test',
      unit: 'INVALID' as never,
      category: 'produce',
    });
    expect('error' in result).toBe(true);
  });
});
