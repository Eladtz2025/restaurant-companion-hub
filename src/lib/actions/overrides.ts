'use server';

export interface ManagerOverride {
  id: string;
  tenantId: string;
  entityType: 'prep_task';
  entityId: string;
  field: string;
  originalValue: unknown;
  overrideValue: unknown;
  reason: string | null;
  overriddenBy: string;
  reverted: boolean;
  revertedBy: string | null;
  revertedAt: string | null;
  createdAt: string;
}

/**
 * STUB. In-memory manager overrides for development. The orchestrator phase
 * replaces this with real DB queries against a `manager_overrides` table.
 */

const store = new Map<string, ManagerOverride[]>();

function ensure(tenantId: string): ManagerOverride[] {
  if (!store.has(tenantId)) store.set(tenantId, []);
  return store.get(tenantId)!;
}

export async function createOverride(
  tenantId: string,
  data: {
    entityType: 'prep_task';
    entityId: string;
    field: 'qty_required';
    originalValue: number;
    overrideValue: number;
    reason?: string | null;
  },
): Promise<ManagerOverride> {
  const list = ensure(tenantId);
  const ov: ManagerOverride = {
    id: `ovr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    tenantId,
    entityType: data.entityType,
    entityId: data.entityId,
    field: data.field,
    originalValue: data.originalValue,
    overrideValue: data.overrideValue,
    reason: data.reason ?? null,
    overriddenBy: 'current_user',
    reverted: false,
    revertedBy: null,
    revertedAt: null,
    createdAt: new Date().toISOString(),
  };
  list.unshift(ov);
  return { ...ov };
}

export async function revertOverride(
  tenantId: string,
  overrideId: string,
): Promise<ManagerOverride> {
  const list = ensure(tenantId);
  const idx = list.findIndex((o) => o.id === overrideId);
  if (idx === -1) throw new Error('Override not found');
  const next: ManagerOverride = {
    ...list[idx]!,
    reverted: true,
    revertedBy: 'current_user',
    revertedAt: new Date().toISOString(),
  };
  list[idx] = next;
  return { ...next };
}

export async function getOverrides(
  tenantId: string,
  options?: {
    entityType?: 'prep_task';
    entityId?: string;
    includeReverted?: boolean;
  },
): Promise<ManagerOverride[]> {
  return ensure(tenantId)
    .filter((o) => {
      if (options?.entityType && o.entityType !== options.entityType) return false;
      if (options?.entityId && o.entityId !== options.entityId) return false;
      if (!options?.includeReverted && o.reverted) return false;
      return true;
    })
    .map((o) => ({ ...o }));
}
