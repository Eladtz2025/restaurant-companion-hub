'use server';

import { z } from 'zod';

import { createServerSupabaseClient, getAuthContext } from '@/lib/supabase/server';

import type { ManagerOverride } from '@/lib/types';

function rowToOverride(row: Record<string, unknown>): ManagerOverride {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    entityType: row.entity_type as 'prep_task',
    entityId: row.entity_id as string,
    field: row.field as string,
    originalValue: row.original_value,
    overrideValue: row.override_value,
    reason: (row.reason as string | null) ?? null,
    overriddenBy: row.overridden_by as string,
    reverted: row.reverted as boolean,
    revertedBy: (row.reverted_by as string | null) ?? null,
    revertedAt: (row.reverted_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

const CreateOverrideSchema = z.object({
  entityType: z.literal('prep_task'),
  entityId: z.string().uuid(),
  field: z.string().min(1),
  originalValue: z.unknown(),
  overrideValue: z.unknown(),
  reason: z.string().max(500).nullable().optional(),
});

export async function createOverride(
  tenantId: string,
  data: {
    entityType: 'prep_task';
    entityId: string;
    field: string;
    originalValue: unknown;
    overrideValue: unknown;
    reason?: string | null;
  },
): Promise<ManagerOverride> {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error('Unauthorized');

  const validated = CreateOverrideSchema.parse(data);
  const supabase = await createServerSupabaseClient();

  // 1. Record the override
  const { data: row, error } = await supabase
    .from('manager_overrides')
    .insert({
      tenant_id: tenantId,
      entity_type: validated.entityType,
      entity_id: validated.entityId,
      field: validated.field,
      original_value: validated.originalValue,
      override_value: validated.overrideValue,
      reason: validated.reason ?? null,
      overridden_by: ctx.userId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  // 2. Apply the override to prep_tasks
  if (validated.entityType === 'prep_task' && validated.field === 'qty_required') {
    const { error: updateError } = await supabase
      .from('prep_tasks')
      .update({ qty_required: validated.overrideValue as number })
      .eq('tenant_id', tenantId)
      .eq('id', validated.entityId);
    if (updateError) throw new Error(updateError.message);
  }

  return rowToOverride(row as Record<string, unknown>);
}

export async function revertOverride(
  tenantId: string,
  overrideId: string,
): Promise<ManagerOverride> {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error('Unauthorized');

  const supabase = await createServerSupabaseClient();

  // Fetch the override
  const { data: existing, error: fetchError } = await supabase
    .from('manager_overrides')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', overrideId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const override = rowToOverride(existing as Record<string, unknown>);
  if (override.reverted) throw new Error('Override already reverted');

  // Restore original value on prep_tasks
  if (override.entityType === 'prep_task' && override.field === 'qty_required') {
    const { error: updateError } = await supabase
      .from('prep_tasks')
      .update({ qty_required: override.originalValue as number })
      .eq('tenant_id', tenantId)
      .eq('id', override.entityId);
    if (updateError) throw new Error(updateError.message);
  }

  // Mark as reverted
  const { data: row, error } = await supabase
    .from('manager_overrides')
    .update({ reverted: true, reverted_by: ctx.userId, reverted_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', overrideId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  return rowToOverride(row as Record<string, unknown>);
}

export async function getOverrides(
  tenantId: string,
  options?: { entityType?: 'prep_task'; entityId?: string; includeReverted?: boolean },
): Promise<ManagerOverride[]> {
  const supabase = await createServerSupabaseClient();
  let q = supabase.from('manager_overrides').select('*').eq('tenant_id', tenantId);
  if (options?.entityType) q = q.eq('entity_type', options.entityType);
  if (options?.entityId) q = q.eq('entity_id', options.entityId);
  if (!options?.includeReverted) q = q.eq('reverted', false);
  q = q.order('created_at', { ascending: false });
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToOverride(r as Record<string, unknown>));
}
