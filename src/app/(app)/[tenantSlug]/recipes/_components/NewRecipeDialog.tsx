'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
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
import { createRecipe } from '@/lib/actions/recipes';

import type { IngredientUnit, RecipeType } from '@/lib/types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
};

const UNIT_OPTIONS: { value: IngredientUnit; label: string }[] = [
  { value: 'kg', label: 'ק"ג' },
  { value: 'g', label: 'גרם' },
  { value: 'l', label: 'ליטר' },
  { value: 'ml', label: 'מ"ל' },
  { value: 'unit', label: 'יחידה' },
  { value: 'pkg', label: 'אריזה' },
];

export function NewRecipeDialog({ open, onOpenChange, tenantId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [nameHe, setNameHe] = useState('');
  const [type, setType] = useState<RecipeType>('menu');
  const [yieldQty, setYieldQty] = useState('1');
  const [yieldUnit, setYieldUnit] = useState<IngredientUnit>('unit');

  function reset() {
    setNameHe('');
    setType('menu');
    setYieldQty('1');
    setYieldUnit('unit');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nameHe.trim();
    if (!trimmed) {
      toast.error('יש להזין שם מתכון');
      return;
    }
    if (trimmed.length > 100) {
      toast.error('שם המתכון ארוך מדי (מקסימום 100 תווים)');
      return;
    }
    const qty = Number(yieldQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error('כמות תפוקה חייבת להיות מספר חיובי');
      return;
    }

    startTransition(async () => {
      try {
        const recipe = await createRecipe(tenantId, {
          nameHe: trimmed,
          type,
          yieldQty: qty,
          yieldUnit,
        });
        toast.success('המתכון נוצר בהצלחה');
        reset();
        onOpenChange(false);
        router.refresh();
        // Navigate to recipe detail page (resolve tenantSlug from URL)
        const slug = window.location.pathname.split('/')[1];
        router.push(`/${slug}/recipes/${recipe.id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'שגיאה ביצירת המתכון');
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!isPending) onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>מתכון חדש</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="recipe-name">שם המתכון *</Label>
            <Input
              id="recipe-name"
              value={nameHe}
              onChange={(e) => setNameHe(e.target.value)}
              maxLength={100}
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="recipe-type">סוג *</Label>
            <Select value={type} onValueChange={(v) => setType(v as RecipeType)}>
              <SelectTrigger id="recipe-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="menu">מנה תפריט</SelectItem>
                <SelectItem value="prep">הכנה</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="yield-qty">כמות תפוקה</Label>
              <Input
                id="yield-qty"
                type="number"
                min="0.001"
                step="0.001"
                value={yieldQty}
                onChange={(e) => setYieldQty(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="yield-unit">יחידת תפוקה</Label>
              <Select value={yieldUnit} onValueChange={(v) => setYieldUnit(v as IngredientUnit)}>
                <SelectTrigger id="yield-unit">
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

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              צור מתכון
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
