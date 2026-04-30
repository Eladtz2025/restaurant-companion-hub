import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { Mock } from 'vitest';

// We mock the Supabase server client so the audit tests don't need a real DB.
vi.mock('@/lib/supabase/server', () => {
  const insertMock = vi.fn().mockResolvedValue({ error: null });
  const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
  return {
    createServerSupabaseClient: vi.fn().mockResolvedValue({ from: fromMock }),
    getAuthContext: vi.fn().mockResolvedValue({ userId: 'user-1', tenantId: 'tenant-1' }),
  };
});

import { logAuditEvent } from '@/lib/audit/logger';

describe('logAuditEvent', () => {
  let insertMock: Mock;
  let fromMock: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { createServerSupabaseClient } = await import('@/lib/supabase/server');
    const client = await (createServerSupabaseClient as Mock)();
    fromMock = client.from as Mock;
    const insertChain = fromMock('_audit_log');
    insertMock = insertChain.insert as Mock;
  });

  it('calls _audit_log.insert with correct fields', async () => {
    await logAuditEvent({
      tenantId: 'tenant-1',
      userId: 'user-1',
      action: 'menu_item.price_changed',
      entityType: 'menu_items',
      entityId: 'item-1',
      beforeData: { price_cents: 5000 },
      afterData: { price_cents: 6000 },
    });

    expect(fromMock).toHaveBeenCalledWith('_audit_log');
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        action: 'menu_item.price_changed',
        table_name: 'menu_items',
        record_id: 'item-1',
        old_data: { price_cents: 5000 },
        new_data: { price_cents: 6000 },
      }),
    );
  });

  it('accepts events without before/after data (e.g. create)', async () => {
    await logAuditEvent({
      tenantId: 'tenant-1',
      userId: 'user-1',
      action: 'recipe.deleted',
      entityType: 'recipes',
      entityId: 'recipe-1',
    });

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'recipe.deleted',
        old_data: null,
        new_data: null,
      }),
    );
  });

  it('does not throw when Supabase returns an error (audit failure is non-fatal)', async () => {
    const { createServerSupabaseClient } = await import('@/lib/supabase/server');
    const client = await (createServerSupabaseClient as Mock)();
    (client.from as Mock).mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
    });

    await expect(
      logAuditEvent({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'menu_item.deleted',
        entityType: 'menu_items',
        entityId: 'item-2',
      }),
    ).resolves.not.toThrow();
  });

  it('stores before data on price change events', async () => {
    await logAuditEvent({
      tenantId: 'tenant-1',
      userId: 'user-1',
      action: 'menu_item.price_changed',
      entityType: 'menu_items',
      entityId: 'item-3',
      beforeData: { price_cents: 3000 },
      afterData: { price_cents: 3500 },
    });

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        old_data: { price_cents: 3000 },
        new_data: { price_cents: 3500 },
      }),
    );
  });

  it('stores delete event with before data and no after data', async () => {
    await logAuditEvent({
      tenantId: 'tenant-1',
      userId: 'user-1',
      action: 'ingredient.deleted',
      entityType: 'ingredients',
      entityId: 'ing-1',
      beforeData: { name_he: 'עוף', unit: 'kg' },
    });

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ingredient.deleted',
        old_data: { name_he: 'עוף', unit: 'kg' },
        new_data: null,
      }),
    );
  });
});
