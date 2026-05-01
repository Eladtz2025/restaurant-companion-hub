'use server';

import { deduplicateRows, parseIngredientCSV } from '@/lib/ingredients/csv-importer';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import type { ImportResult } from './ingredients.types';

export async function importIngredientsAction(
  tenantId: string,
  csvText: string,
): Promise<ImportResult> {
  const { valid, invalid } = parseIngredientCSV(csvText);
  const errors = invalid.map((e) => e.reason);

  if (valid.length === 0) {
    return { imported: 0, skipped: 0, errors };
  }

  const deduplicated = deduplicateRows(valid);
  const skipped = valid.length - deduplicated.length;

  const supabase = await createServerSupabaseClient();

  // Fetch existing names to identify true duplicates already in DB
  const { data: existing } = await supabase
    .from('ingredients')
    .select('name_he')
    .eq('tenant_id', tenantId);

  const existingNames = new Set(
    (existing ?? []).map((r: { name_he: string }) => r.name_he.toLowerCase()),
  );

  const toUpsert = deduplicated.map((row) => ({
    tenant_id: tenantId,
    name_he: row.name_he,
    unit: row.unit,
    category: row.category,
    cost_per_unit_cents: row.cost_per_unit_cents,
    pkg_qty: row.pkg_qty ?? null,
  }));

  // Upsert: insert new, update existing by name_he within tenant
  // Since there's no unique constraint on (tenant_id, name_he) yet, we split into insert/update
  const newRows = toUpsert.filter((r) => !existingNames.has(r.name_he.toLowerCase()));
  const updateRows = toUpsert.filter((r) => existingNames.has(r.name_he.toLowerCase()));

  let imported = 0;

  if (newRows.length > 0) {
    const { error } = await supabase.from('ingredients').insert(newRows);
    if (error) {
      errors.push(`שגיאה בייבוא: ${error.message}`);
      return { imported: 0, skipped, errors };
    }
    imported += newRows.length;
  }

  for (const row of updateRows) {
    const { error } = await supabase
      .from('ingredients')
      .update({
        unit: row.unit,
        category: row.category,
        cost_per_unit_cents: row.cost_per_unit_cents,
        pkg_qty: row.pkg_qty,
      })
      .eq('tenant_id', tenantId)
      .eq('name_he', row.name_he);
    if (error) {
      errors.push(`שגיאה בעדכון "${row.name_he}": ${error.message}`);
    } else {
      imported++;
    }
  }

  return { imported, skipped, errors };
}
