'use client';

import { Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { removeComponent, updateComponent } from '@/lib/actions/recipes';

import { AddComponentDialog } from './AddComponentPopover';

import type { Ingredient, IngredientUnit, Recipe, RecipeComponent } from '@/lib/types';

const UNIT_OPTIONS: { value: IngredientUnit; label: string }[] = [
  { value: 'kg', label: 'ק"ג' },
  { value: 'g', label: 'גרם' },
  { value: 'l', label: 'ליטר' },
  { value: 'ml', label: 'מ"ל' },
  { value: 'unit', label: 'יחידה' },
  { value: 'pkg', label: 'אריזה' },
];

type Props = {
  tenantId: string;
  recipeId: string;
  components: RecipeComponent[];
  setComponents: (updater: (prev: RecipeComponent[]) => RecipeComponent[]) => void;
  ingredientsMap: Map<string, Ingredient>;
  prepMap: Map<string, Recipe>;
  ingredients: Ingredient[];
  prepRecipes: Recipe[];
  canEdit: boolean;
};

export function BomTable({
  tenantId,
  recipeId,
  components,
  setComponents,
  ingredientsMap,
  prepMap,
  ingredients,
  prepRecipes,
  canEdit,
}: Props) {
  const [addOpen, setAddOpen] = useState<'ingredient' | 'subRecipe' | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">רכיבי המתכון</h2>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>כמות</TableHead>
              <TableHead>יחידה</TableHead>
              <TableHead>עלות</TableHead>
              {canEdit && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {components.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 5 : 4} className="text-muted-foreground text-center">
                  אין רכיבים — הוסף מרכיב או תת-מתכון
                </TableCell>
              </TableRow>
            ) : (
              components.map((c) => (
                <ComponentRow
                  key={c.id}
                  tenantId={tenantId}
                  component={c}
                  ingredient={c.ingredientId ? ingredientsMap.get(c.ingredientId) : undefined}
                  subRecipe={c.subRecipeId ? prepMap.get(c.subRecipeId) : undefined}
                  canEdit={canEdit}
                  onChange={(next) =>
                    setComponents((prev) => prev.map((p) => (p.id === next.id ? next : p)))
                  }
                  onRemove={() => setComponents((prev) => prev.filter((p) => p.id !== c.id))}
                  onRestore={(restored) =>
                    setComponents((prev) =>
                      prev.some((p) => p.id === restored.id) ? prev : [...prev, restored],
                    )
                  }
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAddOpen('ingredient')}>
            + הוסף מרכיב
          </Button>
          <Button variant="outline" onClick={() => setAddOpen('subRecipe')}>
            + הוסף תת-מתכון
          </Button>
        </div>
      )}

      <AddComponentDialog
        open={addOpen !== null}
        mode={addOpen ?? 'ingredient'}
        onOpenChange={(open) => !open && setAddOpen(null)}
        tenantId={tenantId}
        recipeId={recipeId}
        ingredients={ingredients}
        prepRecipes={prepRecipes}
        onAdded={(component) => {
          setComponents((prev) => [...prev, component]);
        }}
      />
    </div>
  );
}

function ComponentRow({
  tenantId,
  component,
  ingredient,
  subRecipe,
  canEdit,
  onChange,
  onRemove,
  onRestore,
}: {
  tenantId: string;
  component: RecipeComponent;
  ingredient?: Ingredient;
  subRecipe?: Recipe;
  canEdit: boolean;
  onChange: (next: RecipeComponent) => void;
  onRemove: () => void;
  onRestore: (component: RecipeComponent) => void;
}) {
  const [, startTransition] = useTransition();
  const [qtyInput, setQtyInput] = useState(String(component.qty));

  const displayName = ingredient
    ? ingredient.nameHe
    : subRecipe
      ? `${subRecipe.nameHe} (הכנה)`
      : '—';

  const cost = ingredient ? (ingredient.costPerUnitCents / 100) * component.qty : null;
  const costLabel = cost === null ? '—' : `₪${cost.toFixed(2)}`;

  function commitQty() {
    const next = Number(qtyInput);
    if (!Number.isFinite(next) || next <= 0) {
      setQtyInput(String(component.qty));
      toast.error('כמות חייבת להיות מספר חיובי');
      return;
    }
    if (next === component.qty) return;
    startTransition(async () => {
      try {
        const updated = await updateComponent(tenantId, component.id, { qty: next });
        onChange(updated);
      } catch (err) {
        setQtyInput(String(component.qty));
        toast.error(err instanceof Error ? err.message : 'שגיאה בעדכון');
      }
    });
  }

  function commitUnit(unit: IngredientUnit) {
    if (unit === component.unit) return;
    startTransition(async () => {
      try {
        const updated = await updateComponent(tenantId, component.id, { unit });
        onChange(updated);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'שגיאה בעדכון');
      }
    });
  }

  function handleRemove() {
    const snapshot = component;
    onRemove(); // optimistic
    startTransition(async () => {
      try {
        await removeComponent(tenantId, component.id);
      } catch (err) {
        onRestore(snapshot);
        toast.error(err instanceof Error ? err.message : 'שגיאה במחיקה');
      }
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{displayName}</TableCell>
      <TableCell>
        {canEdit ? (
          <Input
            type="number"
            min="0.001"
            step="0.001"
            value={qtyInput}
            onChange={(e) => setQtyInput(e.target.value)}
            onBlur={commitQty}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
            }}
            className="h-8 w-24"
          />
        ) : (
          component.qty
        )}
      </TableCell>
      <TableCell>
        {canEdit ? (
          <Select value={component.unit} onValueChange={(v) => commitUnit(v as IngredientUnit)}>
            <SelectTrigger className="h-8 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_OPTIONS.map((u) => (
                <SelectItem key={u.value} value={u.value}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          UNIT_OPTIONS.find((u) => u.value === component.unit)?.label
        )}
      </TableCell>
      <TableCell>{costLabel}</TableCell>
      {canEdit && (
        <TableCell>
          <Button variant="ghost" size="sm" onClick={handleRemove} aria-label="הסר">
            <Trash2 className="h-4 w-4" />
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}
