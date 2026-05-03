'use server';

import { z } from 'zod';

import { createServerSupabaseClient, getAuthContext } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = { from: (table: string) => any };

export type WasteReason =
  | 'spoilage'
  | 'over-prep'
  | 'spillage'
  | 'returned-dish'
  | 'staff-meal'
  | 'other';

export type WasteEvent = {
  id: string;
  tenantId: string;
  ingredientId: string;
  ingredientNameHe: string;
  qty: number;
  unit: string;
  reason: WasteReason;
  reasonNotes: string | null;
  reportedBy: string | null;
  occurredAt: string;
};

export type WasteReportRow = {
  ingredientId: string;
  ingredientNameHe: string;
  unit: string;
  totalQty: number;
  byReason: Partial<Record<WasteReason, number>>;
};

const ReportWasteSchema = z.object({
  ingredientId: z.string().uuid(),
  qty: z.number().positive(),
  unit: z.string().min(1),
  reason: z.enum(['spoilage', 'over-prep', 'spillage', 'returned-dish', 'staff-meal', 'other']),
  reasonNotes: z.string().optional(),
  occurredAt: z.string().datetime().optional(),
});

function rowToEvent(row: Record<string, unknown>, ingredient: Record<string, unknown>): WasteEvent {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    ingredientId: row.ingredient_id as string,
    ingredientNameHe: (ingredient.name_he as string) ?? '',
    qty: Number(row.qty),
    unit: row.unit as string,
    reason: row.reason as WasteReason,
    reasonNotes: (row.reason_notes as string | null) ?? null,
    reportedBy: (row.reported_by as string | null) ?? null,
    occurredAt: row.occurred_at as string,
  };
}

export async function reportWaste(
  tenantId: string,
  data: {
    ingredientId: string;
    qty: number;
    unit: string;
    reason: WasteReason;
    reasonNotes?: string;
    occurredAt?: string;
  },
): Promise<WasteEvent> {
  const validated = ReportWasteSchema.parse(data);
  const ctx = await getAuthContext();
  const supabase = await createServerSupabaseClient();
  const db = supabase as unknown as AnySupabase;

  const { data: row, error } = await db
    .from('waste_events')
    .insert({
      tenant_id: tenantId,
      ingredient_id: validated.ingredientId,
      qty: validated.qty,
      unit: validated.unit,
      reason: validated.reason,
      reason_notes: validated.reasonNotes ?? null,
      reported_by: ctx?.userId ?? null,
      occurred_at: validated.occurredAt ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { data: ingredient } = await db
    .from('ingredients')
    .select('name_he')
    .eq('id', validated.ingredientId)
    .single();

  return rowToEvent(row as Record<string, unknown>, (ingredient as Record<string, unknown>) ?? {});
}

export async function getWasteReport(
  tenantId: string,
  from: string,
  to: string,
): Promise<WasteReportRow[]> {
  const supabase = await createServerSupabaseClient();
  const db = supabase as unknown as AnySupabase;

  const { data, error } = await db
    .from('waste_events')
    .select('ingredient_id, qty, unit, reason, occurred_at, ingredients!inner(name_he)')
    .eq('tenant_id', tenantId)
    .gte('occurred_at', from)
    .lte('occurred_at', to)
    .order('occurred_at', { ascending: false });

  if (error) throw new Error(error.message);

  const grouped = new Map<string, WasteReportRow>();
  for (const row of (data as Record<string, unknown>[]) ?? []) {
    const iid = row.ingredient_id as string;
    const ing = row.ingredients as Record<string, unknown>;
    if (!grouped.has(iid)) {
      grouped.set(iid, {
        ingredientId: iid,
        ingredientNameHe: ing.name_he as string,
        unit: row.unit as string,
        totalQty: 0,
        byReason: {},
      });
    }
    const entry = grouped.get(iid)!;
    const reason = row.reason as WasteReason;
    entry.totalQty += Number(row.qty);
    entry.byReason[reason] = (entry.byReason[reason] ?? 0) + Number(row.qty);
  }

  return [...grouped.values()].sort((a, b) => b.totalQty - a.totalQty);
}

export async function getWasteToday(tenantId: string): Promise<WasteEvent[]> {
  const today = new Date().toLocaleDateString('sv-SE');
  const supabase = await createServerSupabaseClient();
  const db = supabase as unknown as AnySupabase;

  const { data, error } = await db
    .from('waste_events')
    .select('*, ingredients!inner(name_he)')
    .eq('tenant_id', tenantId)
    .gte('occurred_at', today)
    .lt('occurred_at', `${today}T23:59:59.999Z`)
    .order('occurred_at', { ascending: false });

  if (error) throw new Error(error.message);

  return ((data as Record<string, unknown>[]) ?? []).map((row) => {
    const ing = row.ingredients as Record<string, unknown>;
    return rowToEvent(row, ing);
  });
}
