'use server';

import { readFile } from 'fs/promises';
import path from 'path';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { callAIGateway } from '@/lib/ai/gateway';

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

function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function findIngredientMatch(
  name: string,
  candidates: Array<{ id: string; name_he: string }>,
): { id: string; name_he: string } | null {
  const nameLower = name.toLowerCase();
  const exact = candidates.find((c) => c.name_he.toLowerCase() === nameLower);
  if (exact) return exact;
  const substring = candidates.find((c) => {
    const cLower = c.name_he.toLowerCase();
    return cLower.includes(nameLower) || nameLower.includes(cLower);
  });
  if (substring) return substring;
  // Prefix-based fuzzy match: share at least 4 characters at the start
  const prefix = candidates.find((c) => {
    const cLower = c.name_he.toLowerCase();
    return commonPrefixLength(nameLower, cLower) >= 4;
  });
  return prefix ?? null;
}

export async function generateRecipeBOM(
  tenantId: string,
  description: string,
): Promise<GenerateRecipeBOMResult> {
  // Load system prompt from file
  let systemPrompt: string;
  try {
    const promptPath = path.join(process.cwd(), 'prompts', 'recipe-bom-assistant', 'v1.md');
    systemPrompt = await readFile(promptPath, 'utf-8');
  } catch {
    throw new Error('AI prompt file not found');
  }

  // Call AI Gateway
  const response = await callAIGateway({
    task: 'recipe.bom_from_description',
    systemPrompt,
    userMessage: description,
  });

  // Parse JSON response
  let bom: GeneratedBOM;
  try {
    const raw = JSON.parse(response.content) as {
      recipe_name_he: string;
      yield_qty: number;
      yield_unit: string;
      components: Array<{
        ingredient_name_he: string;
        qty: number;
        unit: string;
        notes: string | null;
      }>;
      instructions_summary: string;
      confidence: 'high' | 'medium' | 'low';
      warnings: string[];
    };
    bom = {
      recipeNameHe: raw.recipe_name_he,
      yieldQty: raw.yield_qty,
      yieldUnit: raw.yield_unit as IngredientUnit,
      components: raw.components.map((c) => ({
        ingredientNameHe: c.ingredient_name_he,
        qty: c.qty,
        unit: c.unit as IngredientUnit,
        notes: c.notes,
      })),
      instructionsSummary: raw.instructions_summary,
      confidence: raw.confidence,
      warnings: raw.warnings,
    };
  } catch {
    throw new Error('תגובת ה-AI אינה תקינה — נסה שוב');
  }

  // Fuzzy-match ingredients to tenant DB
  const supabase = await createServerSupabaseClient();
  const { data: ingredients } = await supabase
    .from('ingredients')
    .select('id, name_he')
    .eq('tenant_id', tenantId);

  const candidates = (ingredients ?? []) as Array<{ id: string; name_he: string }>;

  const matchedIngredients: MatchResult[] = bom.components.map((comp) => {
    const match = findIngredientMatch(comp.ingredientNameHe, candidates);

    if (!match) {
      return {
        ingredientNameHe: comp.ingredientNameHe,
        matchedIngredientId: null,
        matchedIngredientNameHe: null,
        confidence: 'none',
      };
    }

    // Determine if it was an exact or fuzzy match
    const isExact = match.name_he.toLowerCase() === comp.ingredientNameHe.toLowerCase();
    return {
      ingredientNameHe: comp.ingredientNameHe,
      matchedIngredientId: match.id,
      matchedIngredientNameHe: match.name_he,
      confidence: isExact ? 'exact' : 'fuzzy',
    };
  });

  return { bom, matchedIngredients };
}
