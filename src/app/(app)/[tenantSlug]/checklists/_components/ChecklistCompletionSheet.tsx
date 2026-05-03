'use client';

import { CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  getChecklistCompletion,
  getChecklistWithItems,
  upsertChecklistCompletion,
} from '@/lib/actions/checklists';

import type { Checklist, ChecklistCompletion, ChecklistItem } from '@/lib/types';

interface Props {
  tenantId: string;
  userId: string | null;
  date: string;
  checklist: Checklist | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (completion: ChecklistCompletion) => void;
}

const dateFormatter = new Intl.DateTimeFormat('he-IL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function formatDateHe(iso: string) {
  return dateFormatter.format(new Date(iso + 'T00:00:00'));
}

export function ChecklistCompletionSheet({
  tenantId,
  userId,
  date,
  checklist,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !checklist) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [withItems, completion] = await Promise.all([
          getChecklistWithItems(tenantId, checklist.id),
          getChecklistCompletion(tenantId, checklist.id, date),
        ]);
        if (cancelled) return;
        setItems(withItems?.items ?? []);
        setCompletedItems(new Set(completion?.completedItems ?? []));
        setNotes(completion?.notes ?? '');
        setUpdatedAt(completion?.updatedAt ?? null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'שגיאה בטעינה');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, checklist, tenantId, date]);

  function toggle(itemId: string) {
    setCompletedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  async function handleSave() {
    if (!checklist) return;
    setSaving(true);
    try {
      const result = await upsertChecklistCompletion(tenantId, checklist.id, date, {
        completedBy: userId,
        completedItems: [...completedItems],
        notes: notes.trim() === '' ? null : notes.trim(),
        signatureUrl: null,
      });
      onSaved(result);
      toast.success('הרשימה נשמרה');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  }

  const total = items.length;
  const done = items.filter((i) => completedItems.has(i.id)).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{checklist?.name ?? ''}</SheetTitle>
          <SheetDescription>{formatDateHe(date)}</SheetDescription>
        </SheetHeader>

        {/* Progress bar */}
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>
              {done}/{total} הושלמו
            </span>
            <span>{percent}%</span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div className="bg-primary h-full transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">אין סעיפים ברשימה זו</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((item) => {
                const checked = completedItems.has(item.id);
                return (
                  <li key={item.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
                        checked ? 'border-green-200 bg-green-50' : 'hover:bg-accent/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(item.id)}
                        className="accent-primary h-5 w-5 cursor-pointer"
                      />
                      <span
                        className={`flex-1 text-sm ${
                          checked ? 'text-muted-foreground line-through' : ''
                        }`}
                      >
                        {item.text}
                      </span>
                      {checked && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-4 flex flex-col gap-2">
            <label htmlFor="chk-notes" className="text-sm font-medium">
              הערות
            </label>
            <Textarea
              id="chk-notes"
              value={notes}
              maxLength={500}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="הערות נוספות (עד 500 תווים)"
            />
          </div>

          {updatedAt && (
            <p className="text-muted-foreground mt-3 text-xs">
              עודכן: {new Date(updatedAt).toLocaleString('he-IL')}
            </p>
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            סגור
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? 'שומר…' : 'שמור ✓'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
