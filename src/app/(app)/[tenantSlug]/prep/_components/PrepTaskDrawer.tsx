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
import { Textarea } from '@/components/ui/textarea';
import { updatePrepTaskStatus } from '@/lib/actions/prep';

import type { PrepTask, PrepTaskStatus } from '@/lib/types';

const STATUS_OPTIONS: Array<{ value: PrepTaskStatus; label: string }> = [
  { value: 'pending', label: 'ממתין' },
  { value: 'in_progress', label: 'בביצוע' },
  { value: 'done', label: 'הושלם' },
  { value: 'skipped', label: 'דולג' },
];

interface Props {
  tenantId: string;
  task: PrepTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (task: PrepTask) => void;
}

export function PrepTaskDrawer({ tenantId, task, open, onOpenChange, onSaved }: Props) {
  const [status, setStatus] = useState<PrepTaskStatus>('pending');
  const [qtyActual, setQtyActual] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setStatus(task.status);
      setQtyActual(task.qtyActual === null ? '' : String(task.qtyActual));
      setNotes(task.notes ?? '');
    }
  }, [task]);

  async function handleSave() {
    if (!task) return;
    setSaving(true);
    try {
      const parsedQty = qtyActual.trim() === '' ? null : Number(qtyActual);
      if (parsedQty !== null && (Number.isNaN(parsedQty) || parsedQty < 0)) {
        toast.error('כמות בפועל חייבת להיות מספר חיובי');
        setSaving(false);
        return;
      }
      const updated = await updatePrepTaskStatus(tenantId, task.id, {
        status,
        qtyActual: parsedQty,
        notes: notes.trim() === '' ? null : notes.trim(),
      });
      onSaved(updated);
      toast.success('המשימה עודכנה');
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
          <SheetTitle>עדכון משימה</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="prep-status">סטטוס</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as PrepTaskStatus)}>
              <SelectTrigger id="prep-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="prep-qty">כמות בפועל</Label>
            <Input
              id="prep-qty"
              type="number"
              min={0}
              step="any"
              value={qtyActual}
              onChange={(e) => setQtyActual(e.target.value)}
              placeholder="—"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="prep-notes">הערות</Label>
            <Textarea
              id="prep-notes"
              value={notes}
              maxLength={500}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערות נוספות (עד 500 תווים)"
              rows={4}
            />
            <span className="text-muted-foreground text-xs">{notes.length}/500</span>
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
