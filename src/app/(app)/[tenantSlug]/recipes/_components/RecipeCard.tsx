'use client';

import { Pencil } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

import type { Recipe } from '@/lib/types';

type Props = {
  recipe: Recipe;
  tenantSlug: string;
  /** ingredientId → costPerUnitCents — used to display a hint, not authoritative */
  ingredientCostMap: Map<string, number>;
};

export function RecipeCard({ recipe, tenantSlug }: Props) {
  const isMenu = recipe.type === 'menu';

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex justify-start">
          <Badge
            className={
              isMenu
                ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                : 'bg-amber-100 text-amber-800 hover:bg-amber-100'
            }
          >
            {isMenu ? 'מנה' : 'הכנה'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <h3 className="text-lg font-bold">{recipe.nameHe}</h3>
        <p className="text-muted-foreground text-sm">עלות לא ידועה</p>
        <div className="mt-auto">
          <Button asChild variant="outline" size="sm">
            <Link href={`/${tenantSlug}/recipes/${recipe.id}`}>
              <Pencil className="me-2 h-4 w-4" />
              עריכה
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
