'use server';

import { z } from 'zod';

import { createServerSupabaseClient, getAuthContext } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = { from: (table: string) => any };

export type ReceiptStatus = 'pending' | 'approved' | 'disputed';

export type GoodsReceiptLine = {
  id: string;
  ingredientId: string | null;
  ingredientNameHe: string | null;
  qty: number;
  unit: string;
  costPerUnitCents: number;
  totalCents: number;
};

export type GoodsReceipt = {
  id: string;
  tenantId: string;
  supplierId: string | null;
  supplierName: string | null;
  invoiceNumber: string | null;
  receivedAt: string;
  totalCents: number | null;
  status: ReceiptStatus;
  approvedBy: string | null;
  createdAt: string;
  lines: GoodsReceiptLine[];
};

const ReceiptLineSchema = z.object({
  ingredientId: z.string().uuid().nullable().optional(),
  qty: z.number().positive(),
  unit: z.string().min(1),
  costPerUnitCents: z.number().int().nonnegative(),
});

const CreateReceiptSchema = z.object({
  supplierId: z.string().uuid().nullable().optional(),
  invoiceNumber: z.string().nullable().optional(),
  receivedAt: z.string().datetime(),
  lines: z.array(ReceiptLineSchema).min(1),
});

function rowToReceipt(
  row: Record<string, unknown>,
  lines: GoodsReceiptLine[],
  supplierName: string | null,
): GoodsReceipt {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    supplierId: (row.supplier_id as string | null) ?? null,
    supplierName,
    invoiceNumber: (row.invoice_number as string | null) ?? null,
    receivedAt: row.received_at as string,
    totalCents: row.total_cents != null ? Number(row.total_cents) : null,
    status: row.status as ReceiptStatus,
    approvedBy: (row.approved_by as string | null) ?? null,
    createdAt: row.created_at as string,
    lines,
  };
}

export async function createReceipt(
  tenantId: string,
  data: {
    supplierId?: string | null;
    invoiceNumber?: string | null;
    receivedAt: string;
    lines: {
      ingredientId?: string | null;
      qty: number;
      unit: string;
      costPerUnitCents: number;
    }[];
  },
): Promise<GoodsReceipt> {
  const validated = CreateReceiptSchema.parse(data);
  const supabase = await createServerSupabaseClient();
  const db = supabase as unknown as AnySupabase;

  const totalCents = validated.lines.reduce((sum, l) => sum + l.costPerUnitCents * l.qty, 0);

  const { data: receiptRow, error: receiptErr } = await db
    .from('goods_receipts')
    .insert({
      tenant_id: tenantId,
      supplier_id: validated.supplierId ?? null,
      invoice_number: validated.invoiceNumber ?? null,
      received_at: validated.receivedAt,
      total_cents: Math.round(totalCents),
      status: 'pending',
    })
    .select()
    .single();

  if (receiptErr) throw new Error(receiptErr.message);

  const receipt = receiptRow as Record<string, unknown>;
  const receiptId = receipt.id as string;

  const lineInserts = validated.lines.map((l) => ({
    tenant_id: tenantId,
    receipt_id: receiptId,
    ingredient_id: l.ingredientId ?? null,
    qty: l.qty,
    unit: l.unit,
    cost_per_unit_cents: l.costPerUnitCents,
  }));

  const { data: lineRows, error: linesErr } = await db
    .from('goods_receipt_lines')
    .insert(lineInserts)
    .select('id, ingredient_id, qty, unit, cost_per_unit_cents, total_cents');

  if (linesErr) throw new Error(linesErr.message);

  const ingredientIds = validated.lines.map((l) => l.ingredientId).filter(Boolean) as string[];

  const nameMap = new Map<string, string>();
  if (ingredientIds.length > 0) {
    const { data: ings } = await db
      .from('ingredients')
      .select('id, name_he')
      .in('id', ingredientIds);
    for (const i of (ings as Record<string, unknown>[]) ?? []) {
      nameMap.set(i.id as string, i.name_he as string);
    }
  }

  const lines: GoodsReceiptLine[] = ((lineRows as Record<string, unknown>[]) ?? []).map((l) => ({
    id: l.id as string,
    ingredientId: (l.ingredient_id as string | null) ?? null,
    ingredientNameHe: l.ingredient_id ? (nameMap.get(l.ingredient_id as string) ?? null) : null,
    qty: Number(l.qty),
    unit: l.unit as string,
    costPerUnitCents: Number(l.cost_per_unit_cents),
    totalCents: Number(l.total_cents),
  }));

  return rowToReceipt(receipt, lines, null);
}

export async function approveReceipt(tenantId: string, receiptId: string): Promise<GoodsReceipt> {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error('לא מחובר');

  const supabase = await createServerSupabaseClient();
  const db = supabase as unknown as AnySupabase;

  const { data: receiptRow, error } = await db
    .from('goods_receipts')
    .update({
      status: 'approved',
      approved_by: ctx.userId,
    })
    .eq('tenant_id', tenantId)
    .eq('id', receiptId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  const receipt = receiptRow as Record<string, unknown>;

  // Fetch lines with ingredient info
  const { data: lineRows, error: linesErr } = await db
    .from('goods_receipt_lines')
    .select('id, ingredient_id, qty, unit, cost_per_unit_cents, total_cents')
    .eq('receipt_id', receiptId);

  if (linesErr) throw new Error(linesErr.message);

  const lines = lineRows as Record<string, unknown>[];
  const ingredientIds = lines.map((l) => l.ingredient_id).filter(Boolean) as string[];

  const nameMap = new Map<string, string>();
  if (ingredientIds.length > 0) {
    const { data: ings } = await db
      .from('ingredients')
      .select('id, name_he')
      .in('id', ingredientIds);
    for (const i of (ings as Record<string, unknown>[]) ?? []) {
      nameMap.set(i.id as string, i.name_he as string);
    }

    // Update cost_per_unit on ingredients (latest receipt wins)
    for (const line of lines) {
      if (!line.ingredient_id) continue;
      await db
        .from('ingredients')
        .update({ cost_per_unit: Number(line.cost_per_unit_cents) / 100 })
        .eq('tenant_id', tenantId)
        .eq('id', line.ingredient_id);
    }
  }

  const mappedLines: GoodsReceiptLine[] = lines.map((l) => ({
    id: l.id as string,
    ingredientId: (l.ingredient_id as string | null) ?? null,
    ingredientNameHe: l.ingredient_id ? (nameMap.get(l.ingredient_id as string) ?? null) : null,
    qty: Number(l.qty),
    unit: l.unit as string,
    costPerUnitCents: Number(l.cost_per_unit_cents),
    totalCents: Number(l.total_cents),
  }));

  return rowToReceipt(receipt, mappedLines, null);
}

export async function getReceipts(
  tenantId: string,
  status?: ReceiptStatus,
): Promise<GoodsReceipt[]> {
  const supabase = await createServerSupabaseClient();
  const db = supabase as unknown as AnySupabase;

  let query = db
    .from('goods_receipts')
    .select('*, suppliers(name_he)')
    .eq('tenant_id', tenantId)
    .order('received_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const receipts = (data as Record<string, unknown>[]) ?? [];
  if (receipts.length === 0) return [];

  const receiptIds = receipts.map((r) => r.id as string);

  const { data: allLines, error: linesErr } = await db
    .from('goods_receipt_lines')
    .select(
      'id, receipt_id, ingredient_id, qty, unit, cost_per_unit_cents, total_cents, ingredients(name_he)',
    )
    .in('receipt_id', receiptIds);

  if (linesErr) throw new Error(linesErr.message);

  const linesByReceipt = new Map<string, GoodsReceiptLine[]>();
  for (const line of (allLines as Record<string, unknown>[]) ?? []) {
    const rid = line.receipt_id as string;
    if (!linesByReceipt.has(rid)) linesByReceipt.set(rid, []);
    const ing = line.ingredients as Record<string, unknown> | null;
    linesByReceipt.get(rid)!.push({
      id: line.id as string,
      ingredientId: (line.ingredient_id as string | null) ?? null,
      ingredientNameHe: (ing?.name_he as string | null) ?? null,
      qty: Number(line.qty),
      unit: line.unit as string,
      costPerUnitCents: Number(line.cost_per_unit_cents),
      totalCents: Number(line.total_cents),
    });
  }

  return receipts.map((row) => {
    const supplier = row.suppliers as Record<string, unknown> | null;
    return rowToReceipt(
      row,
      linesByReceipt.get(row.id as string) ?? [],
      (supplier?.name_he as string | null) ?? null,
    );
  });
}
