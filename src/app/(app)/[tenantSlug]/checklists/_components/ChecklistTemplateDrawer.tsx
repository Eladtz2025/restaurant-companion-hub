'use client';

import { useEffect, useState } from 'react';
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { createChecklist, updateChecklist } from '@/lib/actions/checklists';

import type { Checklist, ShiftType } from '@/lib/types';

const SHIFT_OPTIONS: Array<{ value: ShiftType; label: string }> = [
  { value: 'morning', label: 'בוקר' },
  { value: 'afternoon', label: 'צהריים' },
  { value: 'evening', label: 'ערב' },
  { value: 'night', label: 'לילה' },
];

interface Props {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklist: Checklist | null;
  onSaved: (c: Checklist) => void;
}

export function ChecklistTemplateDrawer({
  tenantId,
  open,
  onOpenChange,
  checklist,
  onSaved,
}: Props) {
  const isEdit = !!checklist;
  const [name, setName] = useState('');
  const [shift, setShift] = useState<ShiftType | ''>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(checklist?.name ?? '');
      setShift(checklist?.shift ?? '');
    }
  }, [open, checklist]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('שם הרשימה הוא שדה חובה');
      return;
    }
    if (!shift) {
      toast.error('יש לבחור משמרת');
      return;
    }
    setSaving(true);
    try {
      const saved = isEdit
        ? await updateChecklist(tenantId, checklist!.id, { name: trimmed, shift })
        : await createChecklist(tenantId, { name: trimmed, shift });
      onSaved(saved);
      toast.success(isEdit ? 'הרשימה עודכנה' : 'רשימה נוצרה');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-6">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'עריכת רשימה' : 'רשימה חדשה'}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="chk-name">שם הרשימה *</Label>
            <Input
              id="chk-name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder="למשל: ציוד בוקר"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="chk-shift">משמרת *</Label>
            <Select value={shift} onValueChange={(v) => setShift(v as ShiftType)}>
              <SelectTrigger id="chk-shift">
                <SelectValue placeholder="בחר משמרת" />
              </SelectTrigger>
              <SelectContent>
                {SHIFT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter className="mt-auto">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            ביטול
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'שומר…' : 'שמור'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
