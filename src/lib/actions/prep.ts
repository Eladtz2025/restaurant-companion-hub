'use server';

import { z } from 'zod';

import { createServerSupabaseClient } from '@/lib/supabase/server';

import type { PrepTask, PrepSummary, PrepTaskStatus } from '@/lib/types';

const PrepTaskStatusEnum = z.enum(['pending', 'in_progress', 'done', 'skipped']);

const CreatePrepTaskSchema = z.object({
  recipeId: z.string().uuid(),
  prepDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  qtyRequired: z.number().nonnegative(),
  unit: z.string().min(1),
  notes: z.string().nullable().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
});

const UpdateStatusSchema = z.object({
  status: PrepTaskStatusEnum,
  qtyActual: z.number().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
});

function rowToTask(row: Record<string, unknown>): PrepTask {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    recipeId: row.recipe_id as string,
    prepDate: row.prep_date as string,
    qtyRequired: Number(row.qty_required),
    qtyActual: row.qty_actual != null ? Number(row.qty_actual) : null,
    unit: row.unit as string,
    status: row.status as PrepTaskStatus,
    notes: (row.notes as string | null) ?? null,
    assignedTo: (row.assigned_to as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getPrepTasksForDate(tenantId: string, date: string): Promise<PrepTask[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('prep_tasks')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('prep_date', date)
    .order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToTask);
}

export async function createPrepTask(
  tenantId: string,
  input: {
    recipeId: string;
    prepDate: string;
    qtyRequired: number;
    unit: string;
    notes?: string | null;
    assignedTo?: string | null;
  },
): Promise<PrepTask> {
  const validated = CreatePrepTaskSchema.parse(input);
  const supabase = await createServerSupabaseClient();
  const { data: row, error } = await supabase
    .from('prep_tasks')
    .insert({
      tenant_id: tenantId,
      recipe_id: validated.recipeId,
      prep_date: validated.prepDate,
      qty_required: validated.qtyRequired,
      unit: validated.unit,
      notes: validated.notes ?? null,
      assigned_to: validated.assignedTo ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToTask(row as Record<string, unknown>);
}

export async function updatePrepTaskStatus(
  tenantId: string,
  taskId: string,
  update: {
    status: PrepTaskStatus;
    qtyActual?: number | null;
    notes?: string | null;
  },
): Promise<PrepTask> {
  const validated = UpdateStatusSchema.parse(update);
  const supabase = await createServerSupabaseClient();
  const patch: {
    status: string;
    qty_actual?: number | null;
    notes?: string | null;
    completed_at?: string | null;
  } = { status: validated.status };
  if (validated.qtyActual !== undefined) patch.qty_actual = validated.qtyActual;
  if (validated.notes !== undefined) patch.notes = validated.notes;
  if (validated.status === 'done') patch.completed_at = new Date().toISOString();

  const { data: row, error } = await supabase
    .from('prep_tasks')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('id', taskId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToTask(row as Record<string, unknown>);
}

export async function bulkCreatePrepTasks(
  tenantId: string,
  tasks: Array<{
    recipeId: string;
    prepDate: string;
    qtyRequired: number;
    unit: string;
  }>,
): Promise<PrepTask[]> {
  if (tasks.length === 0) return [];
  const validated = tasks.map((t) => CreatePrepTaskSchema.parse(t));
  const supabase = await createServerSupabaseClient();
  const rows = validated.map((t) => ({
    tenant_id: tenantId,
    recipe_id: t.recipeId,
    prep_date: t.prepDate,
    qty_required: t.qtyRequired,
    unit: t.unit,
  }));
  const { data, error } = await supabase
    .from('prep_tasks')
    .upsert(rows, { onConflict: 'tenant_id,recipe_id,prep_date', ignoreDuplicates: true })
    .select();
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToTask(r as Record<string, unknown>));
}

export async function getPrepSummary(tenantId: string, date: string): Promise<PrepSummary> {
  const tasks = await getPrepTasksForDate(tenantId, date);
  return {
    date,
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
    skipped: tasks.filter((t) => t.status === 'skipped').length,
  };
}
