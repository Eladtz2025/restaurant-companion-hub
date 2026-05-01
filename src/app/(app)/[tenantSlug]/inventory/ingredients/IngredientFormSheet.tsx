'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { createIngredient, updateIngredient } from '@/lib/actions/ingredients';

import type { Ingredient, IngredientCategory, IngredientUnit } from '@/lib/types';

const UNITS: { value: IngredientUnit; label: string }[] = [
  { value: 'kg', label: 'ק"ג' },
  { value: 'g', label: 'גרם' },
  { value: 'l', label: 'ליטר' },
  { value: 'ml', label: 'מ"ל' },
  { value: 'unit', label: "יח'" },
  { value: 'pkg', label: 'אריזה' },
];

const CATEGORIES: { value: IngredientCategory; label: string }[] = [
  { value: 'produce', label: 'ירקות ופירות' },
  { value: 'meat', label: 'בשר' },
  { value: 'fish', label: 'דגים' },
  { value: 'dairy', label: 'חלב' },
  { value: 'dry', label: 'יבש' },
  { value: 'alcohol', label: 'אלכוהול' },
  { value: 'other', label: 'אחר' },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  ingredient: Ingredient | null;
};

export function IngredientFormSheet({ open, onOpenChange, tenantId, ingredient }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [nameHe, setNameHe] = useState('');
  const [unit, setUnit] = useState<IngredientUnit>('kg');
  const [category, setCategory] = useState<IngredientCategory>('other');
  const [costShekels, setCostShekels] = useState('');
  const [pkgQty, setPkgQty] = useState('');

  useEffect(() => {
    if (open) {
      setNameHe(ingredient?.nameHe ?? '');
      setUnit(ingredient?.unit ?? 'kg');
      setCategory(ingredient?.category ?? 'other');
      setCostShekels(
        ingredient ? (ingredient.costPerUnitCents / 100).toFixed(2).replace(/\.00$/, '') : '',
      );
      setPkgQty(ingredient?.pkgQty ? String(ingredient.pkgQty) : '');
    }
  }, [open, ingredient]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = nameHe.trim();
    if (!trimmed) {
      toast.error('שם המרכיב חובה');
      return;
    }

    const costNum = costShekels ? parseFloat(costShekels) : 0;
    if (isNaN(costNum) || costNum < 0) {
      toast.error('מחיר לא תקין');
      return;
    }
    const costCents = Math.round(costNum * 100);

    let pkgQtyNum: number | null = null;
    if (unit === 'pkg' && pkgQty) {
      const n = parseFloat(pkgQty);
      if (isNaN(n) || n <= 0) {
        toast.error('כמות באריזה לא תקינה');
        return;
      }
      pkgQtyNum = n;
    }

    startTransition(async () => {
      const input = {
        nameHe: trimmed,
        unit,
        category,
        costPerUnitCents: costCents,
        pkgQty: pkgQtyNum,
      };

      const result = ingredient
        ? await updateIngredient(tenantId, ingredient.id, input)
        : await createIngredient(tenantId, input);

      if ('error' in result) {
        toast.error(result.error);
        return;
      }

      toast.success(ingredient ? 'המרכיב עודכן' : 'המרכיב נוסף');
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader>
          <SheetTitle>{ingredient ? 'עריכת מרכיב' : 'הוספת מרכיב חדש'}</SheetTitle>
          <SheetDescription>
            {ingredient ? 'ערוך את פרטי המרכיב' : 'הזן את פרטי המרכיב החדש'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">שם *</Label>
            <Input
              id="name"
              value={nameHe}
              onChange={(e) => setNameHe(e.target.value)}
              required
              maxLength={100}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="unit">יחידה *</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as IngredientUnit)}>
              <SelectTrigger id="unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="category">קטגוריה *</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as IngredientCategory)}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cost">מחיר ליחידה (₪)</Label>
            <Input
              id="cost"
              type="number"
              step="0.01"
              min="0"
              value={costShekels}
              onChange={(e) => setCostShekels(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {unit === 'pkg' && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="pkgQty">כמות באריזה</Label>
              <Input
                id="pkgQty"
                type="number"
                step="0.01"
                min="0"
                value={pkgQty}
                onChange={(e) => setPkgQty(e.target.value)}
              />
            </div>
          )}

          <SheetFooter className="mt-auto">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'שומר...' : ingredient ? 'שמור שינויים' : 'הוסף מרכיב'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
