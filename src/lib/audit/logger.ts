import { createServerSupabaseClient } from '@/lib/supabase/server';

import type { Json } from '@/lib/supabase/database.types';

export interface AuditEvent {
  tenantId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
}

export async function logAuditEvent(event: AuditEvent): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('_audit_log').insert({
    tenant_id: event.tenantId,
    user_id: event.userId,
    action: event.action,
    table_name: event.entityType,
    record_id: event.entityId,
    old_data: (event.beforeData ?? null) as Json | null,
    new_data: (event.afterData ?? null) as Json | null,
  });
  if (error) {
    // Audit failures must never silently block the primary operation.
    // Log to stderr and continue; caller decides if this is fatal.
    console.error('[audit] failed to write audit event', error.message, event);
  }
}

export async function withAudit<T>(
  action: string,
  entityType: string,
  fn: () => Promise<{
    id: string;
    before?: unknown;
    after?: unknown;
    tenantId: string;
    userId: string;
  }>,
): Promise<T> {
  const result = await fn();
  await logAuditEvent({
    tenantId: result.tenantId,
    userId: result.userId,
    action,
    entityType,
    entityId: result.id,
    beforeData: result.before as Record<string, unknown> | undefined,
    afterData: result.after as Record<string, unknown> | undefined,
  });
  return result as unknown as T;
}
