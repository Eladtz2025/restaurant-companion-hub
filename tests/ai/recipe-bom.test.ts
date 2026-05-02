import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fs/promises before imports
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('system prompt text'),
}));

// Mock next/headers (required by supabase server client)
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

// Mock supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}));

// Mock AI gateway
vi.mock('@/lib/ai/gateway', () => ({
  callAIGateway: vi.fn(),
}));

import { generateRecipeBOM } from '@/lib/actions/ai-recipe';
import { callAIGateway } from '@/lib/ai/gateway';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const VALID_AI_RESPONSE = JSON.stringify({
  recipe_name_he: 'פסטה ארביאטה',
  yield_qty: 4,
  yield_unit: 'unit',
  components: [{ ingredient_name_he: 'עגבניות', qty: 400, unit: 'g', notes: null }],
  instructions_summary: 'מחממים שמן זית בסיר...',
  confidence: 'high',
  warnings: [],
});

function makeSupabaseMock(ingredients: Array<{ id: string; name_he: string }>) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: ingredients, error: null }),
      }),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateRecipeBOM', () => {
  it('parses valid AI JSON response and returns BOM', async () => {
    (callAIGateway as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: VALID_AI_RESPONSE,
      inputTokens: 10,
      outputTokens: 50,
    });
    (createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSupabaseMock([]),
    );

    const result = await generateRecipeBOM('tenant-1', 'פסטה ארביאטה קלאסית');

    expect(result.bom.recipeNameHe).toBe('פסטה ארביאטה');
    expect(result.bom.components).toHaveLength(1);
    expect(result.bom.yieldQty).toBe(4);
    expect(result.bom.yieldUnit).toBe('unit');
    expect(result.bom.confidence).toBe('high');
    expect(result.bom.warnings).toHaveLength(0);
  });

  it('exact ingredient match returns confidence: exact', async () => {
    (callAIGateway as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: VALID_AI_RESPONSE,
      inputTokens: 10,
      outputTokens: 50,
    });
    (createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSupabaseMock([{ id: 'ing-1', name_he: 'עגבניות' }]),
    );

    const result = await generateRecipeBOM('tenant-1', 'פסטה ארביאטה קלאסית');

    expect(result.matchedIngredients).toHaveLength(1);
    expect(result.matchedIngredients[0]!.confidence).toBe('exact');
    expect(result.matchedIngredients[0]!.matchedIngredientId).toBe('ing-1');
    expect(result.matchedIngredients[0]!.matchedIngredientNameHe).toBe('עגבניות');
  });

  it('fuzzy ingredient match returns confidence: fuzzy', async () => {
    const aiResponseWithTypo = JSON.stringify({
      recipe_name_he: 'פסטה',
      yield_qty: 4,
      yield_unit: 'unit',
      components: [{ ingredient_name_he: 'עגבניה', qty: 400, unit: 'g', notes: null }],
      instructions_summary: 'מחממים...',
      confidence: 'high',
      warnings: [],
    });

    (callAIGateway as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: aiResponseWithTypo,
      inputTokens: 10,
      outputTokens: 50,
    });
    // DB has "עגבניות" — contains "עגבני" which appears in AI name "עגבניה"
    (createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSupabaseMock([{ id: 'ing-2', name_he: 'עגבניות' }]),
    );

    const result = await generateRecipeBOM('tenant-1', 'פסטה');

    expect(result.matchedIngredients[0]!.confidence).toBe('fuzzy');
    expect(result.matchedIngredients[0]!.matchedIngredientId).toBe('ing-2');
  });

  it('throws on invalid JSON response from AI', async () => {
    (callAIGateway as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: 'not valid json',
      inputTokens: 10,
      outputTokens: 5,
    });
    (createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSupabaseMock([]),
    );

    await expect(generateRecipeBOM('tenant-1', 'some description')).rejects.toThrow(
      'תגובת ה-AI אינה תקינה — נסה שוב',
    );
  });

  it('no match returns confidence: none', async () => {
    const aiResponseWithUnknown = JSON.stringify({
      recipe_name_he: 'מנה מיוחדת',
      yield_qty: 2,
      yield_unit: 'unit',
      components: [{ ingredient_name_he: 'טרטיפלט', qty: 100, unit: 'g', notes: null }],
      instructions_summary: 'מכינים...',
      confidence: 'low',
      warnings: ['מרכיב לא מוכר'],
    });

    (callAIGateway as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: aiResponseWithUnknown,
      inputTokens: 10,
      outputTokens: 50,
    });
    (createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSupabaseMock([
        { id: 'ing-10', name_he: 'עגבניות' },
        { id: 'ing-11', name_he: 'גבינה לבנה' },
      ]),
    );

    const result = await generateRecipeBOM('tenant-1', 'מנה עם טרטיפלט');

    expect(result.matchedIngredients[0]!.confidence).toBe('none');
    expect(result.matchedIngredients[0]!.matchedIngredientId).toBeNull();
    expect(result.matchedIngredients[0]!.matchedIngredientNameHe).toBeNull();
  });
});
