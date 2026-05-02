'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface MenuItemFCRow {
  menuItemId: string;
  nameHe: string;
  category: string;
  priceCents: number;
  theoreticalCostCents: number;
  fcPercent: number;
  marginCents: number;
  missingCosts: string[];
}

export interface FCReport {
  rows: MenuItemFCRow[];
  averageFcPercent: number;
  itemsWithMissingCosts: number;
  generatedAt: Date;
}

/**
 * STUB. Returns a basic FC report computed from menu_items only.
 * The orchestrator phase replaces this with a real implementation that
 * walks recipe BOMs, resolves theoretical costs, and caches for 5 min.
 */
export async function getFCReport(tenantId: string): Promise<FCReport> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('menu_items')
    .select('id, name_he, category, price_cents')
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);

  const rows: MenuItemFCRow[] = (data ?? []).map((row) => ({
    menuItemId: row.id as string,
    nameHe: row.name_he as string,
    category: row.category as string,
    priceCents: row.price_cents as number,
    theoreticalCostCents: 0,
    fcPercent: 0,
    marginCents: row.price_cents as number,
    missingCosts: [],
  }));

  return {
    rows,
    averageFcPercent: 0,
    itemsWithMissingCosts: 0,
    generatedAt: new Date(),
  };
}
