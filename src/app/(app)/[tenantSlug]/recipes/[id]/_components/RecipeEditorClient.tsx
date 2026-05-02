'use client';

import { ArrowRight, Loader2, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { IfRole } from '@/components/shared/IfRole';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateRecipe } from '@/lib/actions/recipes';

import { BomTable } from './BomTable';
import { LiveCostPanel } from './LiveCostPanel';

import type { Role } from '@/lib/permissions';
import type {
  Ingredient,
  IngredientUnit,
  Recipe,
  RecipeComponent,
  RecipeWithComponents,
} from '@/lib/types';

const UNIT_LABELS: Record<IngredientUnit, string> = {
  kg: 'ק"ג',
  g: 'גרם',
  l: 'ליטר',
  ml: 'מ"ל',
  unit: 'יחידה',
  pkg: 'אריזה',
};

type Props = {
  tenantId: string;
  tenantSlug: string;
  userRole: Role | null;
  recipe: RecipeWithComponents;
  ingredients: Ingredient[];
  prepRecipes: Recipe[];
};

export function RecipeEditorClient({
  tenantId,
  tenantSlug,
  userRole,
  recipe,
  ingredients,
  prepRecipes,
}: Props) {
  const router = useRouter();
  const [isSaving, startSave] = useTransition();

  // Inline-editable header fields
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(recipe.nameHe);
  const [savedName, setSavedName] = useState(recipe.nameHe);

  useEffect(() => {
    setNameDraft(recipe.nameHe);
    setSavedName(recipe.nameHe);
  }, [recipe.nameHe]);

  // Local components state for optimistic updates
  const [components, setComponents] = useState<RecipeComponent[]>(recipe.components);

  useEffect(() => {
    setComponents(recipe.components);
  }, [recipe.components]);

  const ingredientsMap = useMemo(() => {
    const m = new Map<string, Ingredient>();
    for (const ing of ingredients) m.set(ing.id, ing);
    return m;
  }, [ingredients]);

  const prepMap = useMemo(() => {
    const m = new Map<string, Recipe>();
    for (const r of prepRecipes) m.set(r.id, r);
    return m;
  }, [prepRecipes]);

  const hasChanges = nameDraft.trim() !== savedName && nameDraft.trim().length > 0;

  function handleSaveHeader() {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      toast.error('שם המתכון לא יכול להיות ריק');
      return;
    }
    startSave(async () => {
      try {
        await updateRecipe(tenantId, recipe.id, { nameHe: trimmed });
        setSavedName(trimmed);
        setEditingName(false);
        toast.success('השינויים נשמרו');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'שגיאה בשמירה');
      }
    });
  }

  const isMenu = recipe.type === 'menu';
  const canEdit = userRole === 'owner' || userRole === 'manager';

  return (
    <div className="flex flex-col gap-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/${tenantSlug}/recipes`}>
            <ArrowRight className="me-2 h-4 w-4" />
            חזרה למתכונים
          </Link>
        </Button>
        <IfRole userRole={userRole} roles={['owner', 'manager']}>
          <Button onClick={handleSaveHeader} disabled={!hasChanges || isSaving}>
            {isSaving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            שמור שינויים
          </Button>
        </IfRole>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Badge
            className={
              isMenu
                ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                : 'bg-amber-100 text-amber-800 hover:bg-amber-100'
            }
          >
            {isMenu ? 'מנה' : 'הכנה'}
          </Badge>
          {editingName && canEdit ? (
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveHeader();
                }
                if (e.key === 'Escape') {
                  setNameDraft(savedName);
                  setEditingName(false);
                }
              }}
              maxLength={100}
              className="max-w-md text-2xl font-bold"
              autoFocus
            />
          ) : (
            <button
              type="button"
              className="flex items-center gap-2 text-start"
              onClick={() => canEdit && setEditingName(true)}
              disabled={!canEdit}
            >
              <h1 className="text-2xl font-bold">{nameDraft}</h1>
              {canEdit && <Pencil className="text-muted-foreground h-4 w-4" />}
            </button>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          תפוקה: {recipe.yieldQty} {UNIT_LABELS[recipe.yieldUnit]}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <BomTable
          tenantId={tenantId}
          recipeId={recipe.id}
          components={components}
          setComponents={setComponents}
          ingredientsMap={ingredientsMap}
          prepMap={prepMap}
          ingredients={ingredients}
          prepRecipes={prepRecipes}
          canEdit={canEdit}
        />

        <LiveCostPanel components={components} ingredientsMap={ingredientsMap} />
      </div>
    </div>
  );
}
