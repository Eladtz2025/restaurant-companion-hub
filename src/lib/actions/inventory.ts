'use server';

import { z } from 'zod';

import { createServerSupabaseClient, getAuthContext } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = { from: (table: string) => any };

export type IngredientForCount = {
  id: string;
  nameHe: string;
  unit: string;
  category: string;
  lastCounted: number | null;
  lastCountDate: string | null;
  qtyExpected: number | null;
};

export type InventorySnapshot = {
  id: string;
  tenantId: string;
  ingredientId: string;
  ingredientNameHe: string;
  unit: string;
  qtyExpected: number | null;
  qtyCounted: number | null;
  variance: number | null;
  countDate: string;
  countedBy: string | null;
  notes: string | null;
  createdAt: string;
};

const SaveCountRowSchema = z.object({
  ingredientId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  qtyCounted: z.number().nonnegative(),
  notes: z.string().optional(),
});

export async function getIngredientsForCount(
  tenantId: string,
  category?: string,
): Promise<IngredientForCount[]> {
  const supabase = await createServerSupabaseClient();
  const db = supabase as unknown as AnySupabase;

  let query = db
    .from('ingredients')
    .select('id, name_he, unit, category')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('name_he');

  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  const { data: ingredients, error } = await query;
  if (error) throw new Error(error.message);
  if (!ingredients || ingredients.length === 0) return [];

  const ingredientIds = (ingredients as Record<string, unknown>[]).map((i) => i.id as string);
  const today = new Date().toLocaleDateString('sv-SE');

  const { data: snapshots } = await db
    .from('inventory_snapshots')
    .select('ingredient_id, qty_counted, qty_expected, count_date')
    .eq('tenant_id', tenantId)
    .in('ingredient_id', ingredientIds)
    .lte('count_date', today)
    .order('count_date', { ascending: false });

  const latestByIngredient = new Map<string, Record<string, unknown>>();
  for (const snap of (snapshots as Record<string, unknown>[]) ?? []) {
    const iid = snap.ingredient_id as string;
    if (!latestByIngredient.has(iid)) {
      latestByIngredient.set(iid, snap);
    }
  }

  return (ingredients as Record<string, unknown>[]).map((i) => {
    const snap = latestByIngredient.get(i.id as string);
    return {
      id: i.id as string,
      nameHe: i.name_he as string,
      unit: i.unit as string,
      category: (i.category as string) ?? 'other',
      lastCounted: snap?.qty_counted != null ? Number(snap.qty_counted) : null,
      lastCountDate: snap ? (snap.count_date as string) : null,
      qtyExpected: snap?.qty_expected != null ? Number(snap.qty_expected) : null,
    };
  });
}

export async function saveCountRow(
  tenantId: string,
  ingredientId: string,
  date: string,
  qtyCounted: number,
  notes?: string,
): Promise<InventorySnapshot> {
  const validated = SaveCountRowSchema.parse({ ingredientId, date, qtyCounted, notes });
  const ctx = await getAuthContext();
  const supabase = await createServerSupabaseClient();
  const db = supabase as unknown as AnySupabase;

  const expected = await computeExpectedQty(tenantId, validated.ingredientId, validated.date);

  const { data, error } = await db
    .from('inventory_snapshots')
    .upsert(
      {
        tenant_id: tenantId,
        ingredient_id: validated.ingredientId,
        count_date: validated.date,
        qty_counted: validated.qtyCounted,
        qty_expected: expected,
        counted_by: ctx?.userId ?? null,
        notes: validated.notes ?? null,
      },
      { onConflict: 'tenant_id,ingredient_id,count_date' },
    )
    .select(
      'id, tenant_id, ingredient_id, qty_expected, qty_counted, variance, count_date, counted_by, notes, created_at',
    )
    .single();

  if (error) throw new Error(error.message);

  const { data: ingredient } = await db
    .from('ingredients')
    .select('name_he, unit')
    .eq('id', validated.ingredientId)
    .single();

  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    ingredientId: row.ingredient_id as string,
    ingredientNameHe: (ingredient as Record<string, unknown>)?.name_he as string,
    unit: (ingredient as Record<string, unknown>)?.unit as string,
    qtyExpected: row.qty_expected != null ? Number(row.qty_expected) : null,
    qtyCounted: row.qty_counted != null ? Number(row.qty_counted) : null,
    variance: row.variance != null ? Number(row.variance) : null,
    countDate: row.count_date as string,
    countedBy: (row.counted_by as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function getCountForDate(
  tenantId: string,
  date: string,
): Promise<InventorySnapshot[]> {
  const supabase = await createServerSupabaseClient();
  const db = supabase as unknown as AnySupabase;

  const { data, error } = await db
    .from('inventory_snapshots')
    .select(
      `id, tenant_id, ingredient_id, qty_expected, qty_counted, variance, count_date, counted_by, notes, created_at,
       ingredients!inner(name_he, unit)`,
    )
    .eq('tenant_id', tenantId)
    .eq('count_date', date)
    .order('created_at');

  if (error) throw new Error(error.message);

  return ((data as Record<string, unknown>[]) ?? []).map((row) => {
    const ing = (row.ingredients as Record<string, unknown>) ?? {};
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      ingredientId: row.ingredient_id as string,
      ingredientNameHe: ing.name_he as string,
      unit: ing.unit as string,
      qtyExpected: row.qty_expected != null ? Number(row.qty_expected) : null,
      qtyCounted: row.qty_counted != null ? Number(row.qty_counted) : null,
      variance: row.variance != null ? Number(row.variance) : null,
      countDate: row.count_date as string,
      countedBy: (row.counted_by as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      createdAt: row.created_at as string,
    };
  });
}

export async function getVarianceReport(
  tenantId: string,
  date: string,
  thresholdPct = 5,
): Promise<InventorySnapshot[]> {
  const snapshots = await getCountForDate(tenantId, date);
  return snapshots.filter((s) => {
    if (s.variance === null || s.qtyExpected === null || s.qtyExpected === 0) return false;
    return Math.abs(s.variance / s.qtyExpected) * 100 > thresholdPct;
  });
}

export async function computeExpectedQty(
  tenantId: string,
  ingredientId: string,
  date: string,
): Promise<number | null> {
  const supabase = await createServerSupabaseClient();
  const db = supabase as unknown as AnySupabase;

  // Find the most recent count before today
  const { data: prevSnap } = await db
    .from('inventory_snapshots')
    .select('qty_counted, count_date')
    .eq('tenant_id', tenantId)
    .eq('ingredient_id', ingredientId)
    .lt('count_date', date)
    .order('count_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!prevSnap || (prevSnap as Record<string, unknown>).qty_counted == null) return null;

  const prev = prevSnap as Record<string, unknown>;
  const prevDate = prev.count_date as string;
  let expected = Number(prev.qty_counted);

  // Add goods received between prevDate and date
  const { data: receiptLines } = await db
    .from('goods_receipt_lines')
    .select('qty, goods_receipts!inner(received_at, status)')
    .eq('tenant_id', tenantId)
    .eq('ingredient_id', ingredientId);

  for (const line of (receiptLines as Record<string, unknown>[]) ?? []) {
    const receipt = line.goods_receipts as Record<string, unknown>;
    if (receipt.status !== 'approved') continue;
    const receivedAt = receipt.received_at as string;
    const receivedDate = new Date(receivedAt).toLocaleDateString('sv-SE');
    if (receivedDate > prevDate && receivedDate <= date) {
      expected += Number(line.qty);
    }
  }

  // Subtract theoretical consumption from recipe_components × prep_tasks done
  const { data: prepTasks } = await supabase
    .from('prep_tasks')
    .select('recipe_id, qty_actual, qty_required, status')
    .eq('tenant_id', tenantId)
    .gte('prep_date', prevDate)
    .lt('prep_date', date)
    .in('status', ['done', 'skipped']);

  const recipeIds = [
    ...new Set(((prepTasks as Record<string, unknown>[]) ?? []).map((t) => t.recipe_id as string)),
  ];

  if (recipeIds.length > 0) {
    const { data: components } = await supabase
      .from('recipe_components')
      .select('recipe_id, qty, ingredient_id')
      .in('recipe_id', recipeIds)
      .eq('ingredient_id', ingredientId);

    const compMap = new Map<string, number>();
    for (const c of (components as Record<string, unknown>[]) ?? []) {
      compMap.set(c.recipe_id as string, Number(c.qty));
    }

    for (const task of (prepTasks as Record<string, unknown>[]) ?? []) {
      if (task.status === 'skipped') continue;
      const compQty = compMap.get(task.recipe_id as string);
      if (!compQty) continue;
      const used = task.qty_actual != null ? Number(task.qty_actual) : Number(task.qty_required);
      expected -= compQty * used;
    }
  }

  // Subtract waste events
  const { data: wasteEvents } = await db
    .from('waste_events')
    .select('qty, occurred_at')
    .eq('tenant_id', tenantId)
    .eq('ingredient_id', ingredientId)
    .gte('occurred_at', prevDate)
    .lt('occurred_at', date);

  for (const event of (wasteEvents as Record<string, unknown>[]) ?? []) {
    expected -= Number(event.qty);
  }

  return Math.max(0, expected);
}
