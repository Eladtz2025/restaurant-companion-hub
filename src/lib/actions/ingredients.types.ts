import { z } from 'zod';

export const IngredientSchema = z.object({
  name_he: z.string().min(1).max(100),
  unit: z.enum(['kg', 'g', 'l', 'ml', 'unit', 'pkg']),
  category: z.enum(['produce', 'meat', 'fish', 'dairy', 'dry', 'alcohol', 'other']),
  current_cost_per_unit_cents: z.number().int().min(0).optional(),
  pkg_qty: z.number().positive().optional(),
});

export type IngredientInput = z.infer<typeof IngredientSchema>;

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}
