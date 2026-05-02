'use client';

import { Loader2 } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { addComponent } from '@/lib/actions/recipes';

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
  open: boolean;
  mode: 'ingredient' | 'subRecipe';
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  recipeId: string;
  ingredients: Ingredient[];
  prepRecipes: Recipe[];
  onAdded: (component: RecipeComponent) => void;
};

export function AddComponentDialog({
  open,
  mode,
  onOpenChange,
  tenantId,
  recipeId,
  ingredients,
  prepRecipes,
  onAdded,
}: Props) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState<IngredientUnit>('unit');
  const [isPending, startTransition] = useTransition();

  const items = mode === 'ingredient' ? ingredients : prepRecipes;
  const itemLabel = mode === 'ingredient' ? 'מרכיב' : 'תת-מתכון';

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((i) => i.nameHe.toLowerCase().includes(term));
  }, [items, search]);

  function reset() {
    setSearch('');
    setSelectedId(null);
    setQty('1');
    setUnit('unit');
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    if (mode === 'ingredient') {
      const ing = ingredients.find((i) => i.id === id);
      if (ing) setUnit(ing.unit);
    } else {
      const r = prepRecipes.find((p) => p.id === id);
      if (r) setUnit(r.yieldUnit);
    }
  }

  function handleAdd() {
    if (!selectedId) {
      toast.error(`יש לבחור ${itemLabel}`);
      return;
    }
    const qtyNum = Number(qty);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      toast.error('כמות חייבת להיות מספר חיובי');
      return;
    }

    startTransition(async () => {
      try {
        const component = await addComponent(tenantId, recipeId, {
          ingredientId: mode === 'ingredient' ? selectedId : null,
          subRecipeId: mode === 'subRecipe' ? selectedId : null,
          qty: qtyNum,
          unit,
        });
        onAdded(component);
        toast.success(`${itemLabel === 'מרכיב' ? 'המרכיב' : 'תת-המתכון'} נוסף`);
        reset();
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'שגיאה בהוספה');
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (isPending) return;
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'ingredient' ? 'הוסף מרכיב' : 'הוסף תת-מתכון'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="search-item">{`חיפוש ${itemLabel}`}</Label>
            <Input
              id="search-item"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`חיפוש לפי שם...`}
              autoFocus
            />
          </div>

          <div className="max-h-56 overflow-y-auto rounded-md border">
            {filtered.length === 0 ? (
              <div className="text-muted-foreground p-4 text-center text-sm">
                לא נמצאו תוצאות
              </div>
            ) : (
              <ul className="divide-y">
                {filtered.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      className={`hover:bg-muted w-full px-3 py-2 text-start text-sm ${
                        selectedId === item.id ? 'bg-muted font-semibold' : ''
                      }`}
                    >
                      {item.nameHe}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-qty">כמות</Label>
              <Input
                id="add-qty"
                type="number"
                min="0.001"
                step="0.001"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-unit">יחידה</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as IngredientUnit)}>
                <SelectTrigger id="add-unit">
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
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            ביטול
          </Button>
          <Button onClick={handleAdd} disabled={isPending || !selectedId}>
            {isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            הוסף
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
