'use client';

import { Loader2 } from 'lucide-react';
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
import { createMenuItem, updateMenuItem } from '@/lib/actions/menu-items';

import type { MenuItem } from '@/lib/types';

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'appetizer', label: 'מנה ראשונה' },
  { value: 'main', label: 'עיקרית' },
  { value: 'dessert', label: 'קינוח' },
  { value: 'drink', label: 'שתייה' },
  { value: 'side', label: 'תוסף' },
  { value: 'special', label: 'מיוחד' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  editing: MenuItem | null;
  onSaved: (item: MenuItem) => void;
}

interface FormErrors {
  nameHe?: string;
  category?: string;
  priceCents?: string;
}

export function MenuItemDrawer({ open, onOpenChange, tenantId, editing, onSaved }: Props) {
  const [nameHe, setNameHe] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [category, setCategory] = useState('');
  const [priceDraft, setPriceDraft] = useState('');
  const [posExternalId, setPosExternalId] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setNameHe(editing.nameHe);
      setNameEn(editing.nameEn ?? '');
      setCategory(editing.category);
      setPriceDraft((editing.priceCents / 100).toFixed(2));
      setPosExternalId(editing.posExternalId ?? '');
    } else {
      setNameHe('');
      setNameEn('');
      setCategory('');
      setPriceDraft('');
      setPosExternalId('');
    }
    setErrors({});
  }, [open, editing]);

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!nameHe.trim()) next.nameHe = 'שם המנה הוא שדה חובה';
    if (!category) next.category = 'יש לבחור קטגוריה';
    const parsed = parseFloat(priceDraft);
    if (!priceDraft || Number.isNaN(parsed) || parsed < 0) {
      next.priceCents = 'המחיר חייב להיות 0 או יותר';
    }
    return next;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    const payload = {
      nameHe: nameHe.trim(),
      nameEn: nameEn.trim() ? nameEn.trim() : null,
      category,
      priceCents: Math.round(parseFloat(priceDraft) * 100),
      posExternalId: posExternalId.trim() ? posExternalId.trim() : null,
    };

    startTransition(async () => {
      try {
        const saved = editing
          ? await updateMenuItem(tenantId, editing.id, payload)
          : await createMenuItem(tenantId, payload);
        toast.success(editing ? 'הפריט עודכן' : 'הפריט נוסף');
        onSaved(saved);
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'שגיאה בשמירת הפריט');
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" dir="rtl" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="text-right">
          <SheetTitle>{editing ? 'עריכת פריט' : 'הוספת פריט חדש'}</SheetTitle>
          <SheetDescription>מלא את פרטי פריט התפריט.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="space-y-1.5">
            <Label htmlFor="nameHe">שם מנה *</Label>
            <Input
              id="nameHe"
              value={nameHe}
              onChange={(e) => setNameHe(e.target.value)}
              maxLength={100}
              dir="rtl"
              className="text-right"
            />
            {errors.nameHe && <p className="text-destructive text-xs">{errors.nameHe}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nameEn">שם באנגלית</Label>
            <Input
              id="nameEn"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              dir="ltr"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category">קטגוריה *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category" dir="rtl">
                <SelectValue placeholder="בחר קטגוריה" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {CATEGORY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && <p className="text-destructive text-xs">{errors.category}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="price">מחיר (₪) *</Label>
            <Input
              id="price"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={priceDraft}
              onChange={(e) => setPriceDraft(e.target.value)}
              dir="ltr"
              className="text-left"
            />
            {errors.priceCents && <p className="text-destructive text-xs">{errors.priceCents}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pos">מזהה POS</Label>
            <Input
              id="pos"
              value={posExternalId}
              onChange={(e) => setPosExternalId(e.target.value)}
              dir="ltr"
            />
          </div>

          <SheetFooter className="mt-auto flex-row-reverse gap-2 pt-2">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              שמור
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              ביטול
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
