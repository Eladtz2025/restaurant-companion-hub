'use server';

import type { IngredientUnit } from '@/lib/types';

export interface GeneratedBOMComponent {
  ingredientNameHe: string;
  qty: number;
  unit: IngredientUnit;
  notes: string | null;
}

export interface GeneratedBOM {
  recipeNameHe: string;
  yieldQty: number;
  yieldUnit: IngredientUnit;
  components: GeneratedBOMComponent[];
  instructionsSummary: string;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

export interface MatchResult {
  ingredientNameHe: string;
  matchedIngredientId: string | null;
  matchedIngredientNameHe: string | null;
  confidence: 'exact' | 'fuzzy' | 'none';
}

export interface GenerateRecipeBOMResult {
  bom: GeneratedBOM;
  matchedIngredients: MatchResult[];
}

/**
 * STUB. The orchestrator phase wires this to the AI Gateway
 * (LOVABLE_API_KEY) and adds ingredient fuzzy matching.
 */
export async function generateRecipeBOM(
  _tenantId: string,
  _description: string,
): Promise<GenerateRecipeBOMResult> {
  throw new Error('generateRecipeBOM not yet implemented');
}
