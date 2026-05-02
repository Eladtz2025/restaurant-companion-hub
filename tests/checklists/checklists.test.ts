import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll: () => [],
    set: vi.fn(),
    get: vi.fn(),
  }),
}));

type ChecklistRow = {
  id: string;
  tenant_id: string;
  name: string;
  shift: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type ChecklistItemRow = {
  id: string;
  tenant_id: string;
  checklist_id: string;
  text: string;
  sort_order: number;
  created_at: string;
};

type ChecklistCompletionRow = {
  id: string;
  tenant_id: string;
  checklist_id: string;
  completion_date: string;
  completed_by: string | null;
  signature_url: string | null;
  completed_items: string[];
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

let checklistStore: ChecklistRow[] = [];
let itemStore: ChecklistItemRow[] = [];
let completionStore: ChecklistCompletionRow[] = [];
let idSeq = 0;

function makeChecklistRow(partial: Partial<ChecklistRow>): ChecklistRow {
  return {
    id: `checklist-${++idSeq}`,
    tenant_id: 'tenant-1',
    name: 'Test Checklist',
    shift: 'morning',
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

function makeItemRow(partial: Partial<ChecklistItemRow>): ChecklistItemRow {
  return {
    id: `item-${++idSeq}`,
    tenant_id: 'tenant-1',
    checklist_id: '',
    text: 'Test item',
    sort_order: 0,
    created_at: new Date().toISOString(),
    ...partial,
  };
}

function makeCompletionRow(partial: Partial<ChecklistCompletionRow>): ChecklistCompletionRow {
  return {
    id: `completion-${++idSeq}`,
    tenant_id: 'tenant-1',
    checklist_id: '',
    completion_date: '2026-05-02',
    completed_by: null,
    signature_url: null,
    completed_items: [],
    notes: null,
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}));

import { createServerSupabaseClient } from '@/lib/supabase/server';

function mockSupabase() {
  const client = {
    from: vi.fn((table: string) => {
      if (table === 'checklists') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_col: string, val: unknown) => {
              const byTenant = checklistStore.filter((r) => r.tenant_id === val);
              return {
                eq: vi.fn().mockImplementation((col2: string, val2: unknown) => {
                  if (col2 === 'active') {
                    const filtered = byTenant.filter((r) => r.active === val2);
                    return {
                      order: vi.fn().mockReturnValue({
                        eq: vi.fn().mockImplementation((_col3: string, val3: unknown) => {
                          const filtered2 = filtered.filter((r) => r.shift === val3);
                          return {
                            then: (
                              resolve: (v: { data: ChecklistRow[]; error: null }) => unknown,
                            ) => Promise.resolve({ data: filtered2, error: null }).then(resolve),
                          };
                        }),
                        then: (resolve: (v: { data: ChecklistRow[]; error: null }) => unknown) =>
                          Promise.resolve({ data: filtered, error: null }).then(resolve),
                      }),
                    };
                  }
                  const row = checklistStore.find((r) => r.id === val2) ?? null;
                  const err = row ? null : { message: 'not found', code: 'PGRST116' };
                  return {
                    single: () => Promise.resolve({ data: row, error: err }),
                  };
                }),
              };
            }),
          }),
          insert: vi.fn().mockImplementation((data: Partial<ChecklistRow>) => {
            const row = makeChecklistRow({ ...data });
            checklistStore.push(row);
            return {
              select: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: row, error: null }),
              }),
            };
          }),
          update: vi.fn().mockImplementation((patch: Partial<ChecklistRow>) => ({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((_col2: string, id: string) => ({
                select: vi.fn().mockReturnValue({
                  single: () => {
                    const idx = checklistStore.findIndex((r) => r.id === id);
                    if (idx !== -1) Object.assign(checklistStore[idx]!, patch);
                    return Promise.resolve({ data: checklistStore[idx] ?? null, error: null });
                  },
                }),
              })),
            }),
          })),
        };
      }

      if (table === 'checklist_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_col: string, val: unknown) => {
              const byTenant = itemStore.filter((r) => r.tenant_id === val);
              return {
                eq: vi.fn().mockImplementation((_col2: string, val2: unknown) => {
                  const filtered = byTenant.filter((r) => r.checklist_id === val2 || r.id === val2);
                  return {
                    order: vi.fn().mockReturnValue({
                      then: (resolve: (v: { data: ChecklistItemRow[]; error: null }) => unknown) =>
                        Promise.resolve({ data: filtered, error: null }).then(resolve),
                    }),
                    then: (resolve: (v: { data: { id: string }[]; error: null }) => unknown) =>
                      Promise.resolve({
                        data: filtered.map((r) => ({ id: r.id })),
                        error: null,
                      }).then(resolve),
                  };
                }),
              };
            }),
          }),
          insert: vi.fn().mockImplementation((data: Partial<ChecklistItemRow>) => {
            const row = makeItemRow({ ...data });
            itemStore.push(row);
            return {
              select: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: row, error: null }),
              }),
            };
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((_col2: string, id: string) => {
                itemStore = itemStore.filter((r) => r.id !== id);
                return Promise.resolve({ data: null, error: null });
              }),
            }),
          }),
        };
      }

      if (table === 'checklist_completions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_col: string, val: unknown) => {
              const byTenant = completionStore.filter((r) => r.tenant_id === val);
              return {
                eq: vi.fn().mockImplementation((_col2: string, val2: unknown) => {
                  const byChecklist = byTenant.filter((r) => r.checklist_id === val2);
                  return {
                    eq: vi.fn().mockImplementation((_col3: string, val3: unknown) => {
                      const filtered = byChecklist.filter((r) => r.completion_date === val3);
                      return {
                        maybeSingle: () =>
                          Promise.resolve({ data: filtered[0] ?? null, error: null }),
                      };
                    }),
                  };
                }),
              };
            }),
          }),
          upsert: vi.fn().mockImplementation((data: Partial<ChecklistCompletionRow>) => {
            const idx = completionStore.findIndex(
              (r) =>
                r.tenant_id === data.tenant_id &&
                r.checklist_id === data.checklist_id &&
                r.completion_date === data.completion_date,
            );
            let row: ChecklistCompletionRow;
            if (idx !== -1) {
              Object.assign(completionStore[idx]!, data);
              row = completionStore[idx]!;
            } else {
              row = makeCompletionRow({ ...data });
              completionStore.push(row);
            }
            return {
              select: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: row, error: null }),
              }),
            };
          }),
        };
      }

      return {
        select: vi.fn().mockReturnValue({
          then: (resolve: (v: { data: null; error: null }) => unknown) =>
            Promise.resolve({ data: null, error: null }).then(resolve),
        }),
      };
    }),
  };
  (createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);
}

const {
  getChecklists,
  createChecklist,
  getChecklistWithItems,
  addChecklistItem,
  removeChecklistItem,
  getChecklistCompletion,
  upsertChecklistCompletion,
} = await import('@/lib/actions/checklists');

const TENANT = 'tenant-1';

describe('Checklists — CRUD and completion flow', () => {
  beforeEach(() => {
    checklistStore = [];
    itemStore = [];
    completionStore = [];
    idSeq = 0;
    mockSupabase();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('getChecklists returns empty array on fresh tenant', async () => {
    const result = await getChecklists(TENANT);
    expect(result).toHaveLength(0);
  });

  it('createChecklist creates and returns a checklist', async () => {
    const checklist = await createChecklist(TENANT, { name: 'Opening', shift: 'morning' });
    expect(checklist.name).toBe('Opening');
    expect(checklist.shift).toBe('morning');
    expect(checklist.tenantId).toBe(TENANT);
    expect(checklist.active).toBe(true);
    expect(checklistStore).toHaveLength(1);
  });

  it('createChecklist throws for invalid shift enum', async () => {
    await expect(
      // @ts-expect-error intentionally passing invalid shift
      createChecklist(TENANT, { name: 'Bad', shift: 'invalid' }),
    ).rejects.toThrow();
  });

  it('getChecklistWithItems returns checklist with empty items', async () => {
    const checklist = await createChecklist(TENANT, { name: 'Closing', shift: 'evening' });
    const result = await getChecklistWithItems(TENANT, checklist.id);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Closing');
    expect(result!.items).toHaveLength(0);
  });

  it('getChecklistWithItems returns null for unknown id', async () => {
    const result = await getChecklistWithItems(TENANT, 'non-existent-id');
    expect(result).toBeNull();
  });

  it('addChecklistItem adds an item to a checklist', async () => {
    const checklist = await createChecklist(TENANT, { name: 'Morning', shift: 'morning' });
    const item = await addChecklistItem(TENANT, checklist.id, {
      text: 'Clean tables',
      sortOrder: 1,
    });
    expect(item.text).toBe('Clean tables');
    expect(item.sortOrder).toBe(1);
    expect(item.checklistId).toBe(checklist.id);
    expect(itemStore).toHaveLength(1);
  });

  it('removeChecklistItem removes an item', async () => {
    const checklist = await createChecklist(TENANT, { name: 'Night', shift: 'night' });
    const item = await addChecklistItem(TENANT, checklist.id, { text: 'Lock doors' });
    expect(itemStore).toHaveLength(1);
    await removeChecklistItem(TENANT, item.id);
    expect(itemStore).toHaveLength(0);
  });

  it('getChecklistCompletion returns null when no completion exists', async () => {
    const checklist = await createChecklist(TENANT, { name: 'Afternoon', shift: 'afternoon' });
    const result = await getChecklistCompletion(TENANT, checklist.id, '2026-05-02');
    expect(result).toBeNull();
  });

  it('upsertChecklistCompletion creates completion with partial status when some items done', async () => {
    const checklist = await createChecklist(TENANT, { name: 'Morning', shift: 'morning' });
    await addChecklistItem(TENANT, checklist.id, { text: 'Item 1' });
    const item2 = await addChecklistItem(TENANT, checklist.id, { text: 'Item 2' });

    const completion = await upsertChecklistCompletion(TENANT, checklist.id, '2026-05-02', {
      completedItems: [item2.id],
    });

    expect(completion.status).toBe('partial');
    expect(completion.completedItems).toContain(item2.id);
  });

  it('upsertChecklistCompletion sets status to completed when all items done', async () => {
    const checklist = await createChecklist(TENANT, { name: 'Morning', shift: 'morning' });
    const item1 = await addChecklistItem(TENANT, checklist.id, { text: 'Item 1' });
    const item2 = await addChecklistItem(TENANT, checklist.id, { text: 'Item 2' });

    const completion = await upsertChecklistCompletion(TENANT, checklist.id, '2026-05-02', {
      completedItems: [item1.id, item2.id],
    });

    expect(completion.status).toBe('completed');
    expect(completion.completedItems).toHaveLength(2);
  });
});
