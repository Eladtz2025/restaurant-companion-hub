'use server';

import { z } from 'zod';

import { createServerSupabaseClient } from '@/lib/supabase/server';

import type {
  Checklist,
  ChecklistCompletion,
  ChecklistItem,
  ChecklistStatus,
  ChecklistWithItems,
  ShiftType,
} from '@/lib/types';

const ShiftEnum = z.enum(['morning', 'afternoon', 'evening', 'night']);
const StatusEnum = z.enum(['pending', 'partial', 'completed']);

void StatusEnum;

const ChecklistSchema = z.object({
  name: z.string().min(1).max(100),
  shift: ShiftEnum,
  active: z.boolean().optional(),
});

const ChecklistItemSchema = z.object({
  text: z.string().min(1).max(200),
  sortOrder: z.number().int().optional(),
});

function rowToChecklist(row: Record<string, unknown>): Checklist {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    shift: row.shift as ShiftType,
    active: row.active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToItem(row: Record<string, unknown>): ChecklistItem {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    checklistId: row.checklist_id as string,
    text: row.text as string,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
  };
}

function rowToCompletion(row: Record<string, unknown>): ChecklistCompletion {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    checklistId: row.checklist_id as string,
    completionDate: row.completion_date as string,
    completedBy: (row.completed_by as string | null) ?? null,
    signatureUrl: (row.signature_url as string | null) ?? null,
    completedItems: (row.completed_items as string[]) ?? [],
    notes: (row.notes as string | null) ?? null,
    status: row.status as ChecklistStatus,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getChecklists(tenantId: string, shift?: ShiftType): Promise<Checklist[]> {
  const supabase = await createServerSupabaseClient();
  let q = supabase
    .from('checklists')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('name');
  if (shift) q = q.eq('shift', shift);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToChecklist);
}

export async function getChecklistWithItems(
  tenantId: string,
  id: string,
): Promise<ChecklistWithItems | null> {
  const supabase = await createServerSupabaseClient();
  const [checklistRes, itemsRes] = await Promise.all([
    supabase.from('checklists').select('*').eq('tenant_id', tenantId).eq('id', id).single(),
    supabase
      .from('checklist_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('checklist_id', id)
      .order('sort_order'),
  ]);
  if (checklistRes.error?.code === 'PGRST116') return null;
  if (checklistRes.error) throw new Error(checklistRes.error.message);
  if (itemsRes.error) throw new Error(itemsRes.error.message);
  return {
    ...rowToChecklist(checklistRes.data as Record<string, unknown>),
    items: (itemsRes.data ?? []).map(rowToItem),
  };
}

export async function createChecklist(
  tenantId: string,
  data: { name: string; shift: ShiftType; active?: boolean },
): Promise<Checklist> {
  const validated = ChecklistSchema.parse(data);
  const supabase = await createServerSupabaseClient();
  const { data: row, error } = await supabase
    .from('checklists')
    .insert({
      tenant_id: tenantId,
      name: validated.name,
      shift: validated.shift,
      active: validated.active ?? true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToChecklist(row as Record<string, unknown>);
}

export async function updateChecklist(
  tenantId: string,
  id: string,
  data: Partial<{ name: string; shift: ShiftType; active: boolean }>,
): Promise<Checklist> {
  const supabase = await createServerSupabaseClient();
  const patch: { name?: string; shift?: string; active?: boolean } = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.shift !== undefined) patch.shift = data.shift;
  if (data.active !== undefined) patch.active = data.active;
  const { data: row, error } = await supabase
    .from('checklists')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToChecklist(row as Record<string, unknown>);
}

export async function addChecklistItem(
  tenantId: string,
  checklistId: string,
  item: { text: string; sortOrder?: number },
): Promise<ChecklistItem> {
  const validated = ChecklistItemSchema.parse(item);
  const supabase = await createServerSupabaseClient();
  const { data: row, error } = await supabase
    .from('checklist_items')
    .insert({
      tenant_id: tenantId,
      checklist_id: checklistId,
      text: validated.text,
      sort_order: validated.sortOrder ?? 0,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToItem(row as Record<string, unknown>);
}

export async function removeChecklistItem(tenantId: string, itemId: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from('checklist_items')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', itemId);
  if (error) throw new Error(error.message);
}

export async function getChecklistCompletion(
  tenantId: string,
  checklistId: string,
  date: string,
): Promise<ChecklistCompletion | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('checklist_completions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('checklist_id', checklistId)
    .eq('completion_date', date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToCompletion(data as Record<string, unknown>);
}

export async function upsertChecklistCompletion(
  tenantId: string,
  checklistId: string,
  date: string,
  update: {
    completedBy?: string | null;
    completedItems: string[];
    notes?: string | null;
    signatureUrl?: string | null;
  },
): Promise<ChecklistCompletion> {
  const supabase = await createServerSupabaseClient();
  const itemsRes = await supabase
    .from('checklist_items')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('checklist_id', checklistId);
  const totalItems = (itemsRes.data ?? []).length;
  const completedCount = update.completedItems.length;
  const status: ChecklistStatus =
    completedCount === 0 ? 'pending' : completedCount >= totalItems ? 'completed' : 'partial';

  const payload = {
    tenant_id: tenantId,
    checklist_id: checklistId,
    completion_date: date,
    completed_by: update.completedBy ?? null,
    completed_items: update.completedItems,
    notes: update.notes ?? null,
    signature_url: update.signatureUrl ?? null,
    status,
  };

  const { data: row, error } = await supabase
    .from('checklist_completions')
    .upsert(payload, { onConflict: 'tenant_id,checklist_id,completion_date' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToCompletion(row as Record<string, unknown>);
}
