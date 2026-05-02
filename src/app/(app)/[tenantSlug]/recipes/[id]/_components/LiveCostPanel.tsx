'use client';

import { AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';

import { Card, CardContent } from '@/components/ui/card';

import type { Ingredient, RecipeComponent } from '@/lib/types';

type Props = {
  components: RecipeComponent[];
  ingredientsMap: Map<string, Ingredient>;
};

export function LiveCostPanel({ components, ingredientsMap }: Props) {
  const { total, missingCount, hasSubRecipes } = useMemo(() => {
    let total = 0;
    let missingCount = 0;
    let hasSubRecipes = false;
    for (const c of components) {
      if (c.ingredientId) {
        const ing = ingredientsMap.get(c.ingredientId);
        if (ing && ing.costPerUnitCents > 0) {
          total += (ing.costPerUnitCents / 100) * c.qty;
        } else {
          missingCount++;
        }
      } else if (c.subRecipeId) {
        hasSubRecipes = true;
      }
    }
    return { total, missingCount, hasSubRecipes };
  }, [components, ingredientsMap]);

  return (
    <Card className="lg:sticky lg:top-4">
      <CardContent className="flex flex-col gap-3 pt-6">
        <p className="text-muted-foreground text-sm">עלות תיאורטית</p>
        <p className="text-3xl font-bold">₪ {total.toFixed(2)}</p>

        {missingCount > 0 && (
          <div className="text-amber-700 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{missingCount} מרכיבים חסרי מחיר</span>
          </div>
        )}

        {hasSubRecipes && (
          <p className="text-muted-foreground text-xs">
            * עלות תת-מתכונים אינה כלולה בחישוב
          </p>
        )}
      </CardContent>
    </Card>
  );
}
