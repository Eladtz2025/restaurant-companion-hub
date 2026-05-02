'use client';

import { ChefHat, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { IfRole } from '@/components/shared/IfRole';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { NewRecipeDialog } from './NewRecipeDialog';
import { RecipeCard } from './RecipeCard';

import type { Role } from '@/lib/permissions';
import type { Ingredient, Recipe, RecipeType } from '@/lib/types';

type Props = {
  tenantId: string;
  tenantSlug: string;
  userRole: Role | null;
  initialRecipes: Recipe[];
  ingredients: Ingredient[];
};

type FilterTab = 'all' | RecipeType;

export function RecipesClient({
  tenantId,
  tenantSlug,
  userRole,
  initialRecipes,
  ingredients,
}: Props) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<FilterTab>('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const ingredientCostMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const ing of ingredients) m.set(ing.id, ing.costPerUnitCents);
    return m;
  }, [ingredients]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return initialRecipes.filter((r) => {
      if (tab !== 'all' && r.type !== tab) return false;
      if (term && !r.nameHe.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [initialRecipes, search, tab]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="מתכונים"
        subtitle="ניהול מתכונים והכנות"
        actions={
          <IfRole userRole={userRole} roles={['owner', 'manager']}>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="me-2 h-4 w-4" />
              מתכון חדש
            </Button>
          </IfRole>
        }
      />

      <div className="flex flex-col gap-3">
        <Input
          placeholder="חיפוש מתכון..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />

        <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
          <TabsList>
            <TabsTrigger value="all">הכל</TabsTrigger>
            <TabsTrigger value="menu">מנות תפריט</TabsTrigger>
            <TabsTrigger value="prep">הכנות</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-12 text-center">
          <ChefHat className="text-muted-foreground mb-3 h-10 w-10" />
          <p className="text-muted-foreground">
            {search || tab !== 'all' ? 'לא נמצאו מתכונים' : 'אין מתכונים עדיין'}
          </p>
          {!search && tab === 'all' && (
            <IfRole userRole={userRole} roles={['owner', 'manager']}>
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="me-2 h-4 w-4" />
                צור מתכון ראשון
              </Button>
            </IfRole>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              tenantSlug={tenantSlug}
              ingredientCostMap={ingredientCostMap}
            />
          ))}
        </div>
      )}

      <NewRecipeDialog open={dialogOpen} onOpenChange={setDialogOpen} tenantId={tenantId} />
    </div>
  );
}

// Loading skeleton (exported for use by parent loaders if needed)
export function RecipesLoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-44 w-full" />
      ))}
    </div>
  );
}
