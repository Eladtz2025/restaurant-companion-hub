'use client';

import { AlertCircle, History, RotateCcw, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { IfRole } from '@/components/shared/IfRole';
import { Badge } from '@/components/ui/badge';
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
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  createOverride,
  getOverrides,
  revertOverride,
  type ManagerOverride,
} from '@/lib/actions/overrides';
import { updatePrepTaskStatus } from '@/lib/actions/prep';

import type { Role } from '@/lib/permissions';
import type { PrepTask, PrepTaskStatus } from '@/lib/types';

const STATUS_OPTIONS: Array<{ value: PrepTaskStatus; label: string }> = [
  { value: 'pending', label: 'ממתין' },
  { value: 'in_progress', label: 'בביצוע' },
  { value: 'done', label: 'הושלם' },
  { value: 'skipped', label: 'דולג' },
];

interface Props {
  tenantId: string;
  userRole: Role | null;
  task: PrepTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (task: PrepTask) => void;
}

function relativeTimeHe(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'הרגע';
  if (minutes < 60) return `לפני ${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

export function PrepTaskDrawer({
  tenantId,
  userRole,
  task,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const [status, setStatus] = useState<PrepTaskStatus>('pending');
  const [qtyActual, setQtyActual] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const [overrides, setOverrides] = useState<ManagerOverride[]>([]);
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [newQty, setNewQty] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [applyingOverride, setApplyingOverride] = useState(false);

  const isManager = userRole === 'owner' || userRole === 'manager';

  useEffect(() => {
    if (task) {
      setStatus(task.status);
      setQtyActual(task.qtyActual === null ? '' : String(task.qtyActual));
      setNotes(task.notes ?? '');
      setNewQty('');
      setReason('');
    }
  }, [task]);

  useEffect(() => {
    if (!open || !task || !isManager) return;
    let cancelled = false;
    setLoadingOverrides(true);
    getOverrides(tenantId, {
      entityType: 'prep_task',
      entityId: task.id,
      includeReverted: true,
    })
      .then((list) => {
        if (!cancelled) setOverrides(list.slice(0, 5));
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : 'שגיאה בטעינת היסטוריית עקיפות',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingOverrides(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, task, isManager, tenantId]);

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

  async function handleApplyOverride() {
    if (!task) return;
    const parsed = Number(newQty);
    if (newQty.trim() === '' || Number.isNaN(parsed) || parsed <= 0) {
      toast.error('כמות חדשה חייבת להיות מספר חיובי');
      return;
    }
    setApplyingOverride(true);
    try {
      const ov = await createOverride(tenantId, {
        entityType: 'prep_task',
        entityId: task.id,
        field: 'qty_required',
        originalValue: task.qtyRequired,
        overrideValue: parsed,
        reason: reason.trim() === '' ? null : reason.trim(),
      });
      setOverrides((prev) => [ov, ...prev].slice(0, 5));
      setNewQty('');
      setReason('');
      onSaved({
        ...task,
        qtyRequired: parsed,
        updatedAt: new Date().toISOString(),
      });
      toast.success('עקיפה הוחלה');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בהחלת עקיפה');
    } finally {
      setApplyingOverride(false);
    }
  }

  async function handleRevert(ov: ManagerOverride) {
    if (!task) return;
    const prevList = overrides;
    const wasMostRecentActive =
      overrides.find((o) => !o.reverted)?.id === ov.id;
    setOverrides((prev) =>
      prev.map((o) => (o.id === ov.id ? { ...o, reverted: true } : o)),
    );
    try {
      await revertOverride(tenantId, ov.id);
      if (wasMostRecentActive && typeof ov.originalValue === 'number') {
        onSaved({
          ...task,
          qtyRequired: ov.originalValue,
          updatedAt: new Date().toISOString(),
        });
      }
      toast.success('העקיפה בוטלה');
    } catch (err) {
      setOverrides(prevList);
      toast.error(err instanceof Error ? err.message : 'שגיאה בביטול עקיפה');
    }
  }

  const hasActiveOverride = overrides.some((o) => !o.reverted);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-6 overflow-y-auto sm:max-w-md">
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

        <IfRole userRole={userRole} roles={['owner', 'manager']}>
          <Separator />
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              <h3 className="text-sm font-semibold">עקיפת תחזית (מנהל בלבד)</h3>
            </div>

            <div className="bg-muted/40 flex items-center justify-between gap-2 rounded-md border p-3 text-sm">
              <div>
                <span className="text-muted-foreground">כמות נדרשת נוכחית: </span>
                <span className="font-semibold">
                  {task ? `${task.qtyRequired} ${task.unit}` : '—'}
                </span>
              </div>
              {hasActiveOverride && (
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                  מוגדר ע&quot;י מנהל
                </Badge>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="override-qty">כמות חדשה</Label>
              <Input
                id="override-qty"
                type="number"
                min={0}
                step="any"
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                placeholder="הזן כמות"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="override-reason">סיבה (אופציונלי)</Label>
              <Textarea
                id="override-reason"
                value={reason}
                maxLength={200}
                onChange={(e) => setReason(e.target.value)}
                placeholder="מדוע נדרשת עקיפה?"
                rows={2}
              />
              <span className="text-muted-foreground text-xs">{reason.length}/200</span>
            </div>

            <Button onClick={handleApplyOverride} disabled={applyingOverride}>
              {applyingOverride ? 'מחיל…' : 'החל עקיפה'}
            </Button>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4" />
                <h4 className="text-sm font-semibold">היסטוריית עקיפות</h4>
              </div>

              {loadingOverrides ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : overrides.length === 0 ? (
                <p className="text-muted-foreground flex items-center gap-2 py-3 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  אין עקיפות
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {overrides.map((ov) => (
                    <li
                      key={ov.id}
                      className={`flex items-start gap-3 rounded-md border p-3 text-sm ${ov.reverted ? 'opacity-60' : ''}`}
                    >
                      <div className="flex-1">
                        <p className="font-medium">
                          {String(ov.overrideValue)}{' '}
                          <span className="text-muted-foreground font-normal">
                            (היה: {String(ov.originalValue)})
                          </span>
                          {ov.reverted && (
                            <span className="text-muted-foreground ms-2">(בוטל)</span>
                          )}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {relativeTimeHe(ov.createdAt)}
                        </p>
                        {ov.reason && (
                          <p className="text-muted-foreground mt-1 text-xs italic">
                            {ov.reason}
                          </p>
                        )}
                      </div>
                      {!ov.reverted && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevert(ov)}
                          aria-label="בטל עקיפה"
                        >
                          <RotateCcw className="me-1 h-4 w-4" />
                          בטל
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </IfRole>

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
