import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface AuditLogEntry {
  id: string;
  tenantId: string | null;
  userId: string | null;
  action: string;
  tableName: string;
  recordId: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  createdAt: string;
}

function rowToEntry(row: Record<string, unknown>): AuditLogEntry {
  return {
    id: row.id as string,
    tenantId: (row.tenant_id as string | null) ?? null,
    userId: (row.user_id as string | null) ?? null,
    action: row.action as string,
    tableName: row.table_name as string,
    recordId: (row.record_id as string | null) ?? null,
    oldData: (row.old_data as Record<string, unknown> | null) ?? null,
    newData: (row.new_data as Record<string, unknown> | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function getAuditLog(
  tenantId: string,
  filters?: {
    action?: string;
    tableName?: string;
    userId?: string;
    limit?: number;
  },
): Promise<AuditLogEntry[]> {
  const supabase = await createServerSupabaseClient();
  let q = supabase
    .from('_audit_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(filters?.limit ?? 100);

  if (filters?.action) q = q.eq('action', filters.action);
  if (filters?.tableName) q = q.eq('table_name', filters.tableName);
  if (filters?.userId) q = q.eq('user_id', filters.userId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToEntry);
}

export async function getEntityHistory(
  tenantId: string,
  entityType: string,
  entityId: string,
): Promise<AuditLogEntry[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('_audit_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('table_name', entityType)
    .eq('record_id', entityId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToEntry);
}
