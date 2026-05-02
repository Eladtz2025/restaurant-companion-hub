'use client';

import { Calendar, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  getPrepSummary,
  getPrepTasksForDate,
  updatePrepTaskStatus,
} from '@/lib/actions/prep';

import { PrepTaskDrawer } from './PrepTaskDrawer';

import type { Role } from '@/lib/permissions';
import type { PrepSummary, PrepTask, PrepTaskStatus } from '@/lib/types';

interface Props {
  tenantId: string;
  tenantSlug: string;
  userRole: Role | null;
}

const STATUS_META: Record<
  PrepTaskStatus,
  { label: string; badge: string }
> = {
  pending: { label: 'ממתין', badge: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' },
  in_progress: { label: 'בביצוע', badge: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
  done: { label: 'הושלם', badge: 'bg-green-100 text-green-800 hover:bg-green-100' },
  skipped: { label: 'דולג', badge: 'bg-gray-100 text-gray-700 hover:bg-gray-100' },
};

const STATUS_OPTIONS: PrepTaskStatus[] = ['pending', 'in_progress', 'done', 'skipped'];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const dateFormatter = new Intl.DateTimeFormat('he-IL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function formatDateHe(iso: string): string {
  return dateFormatter.format(new Date(iso + 'T00:00:00'));
}

function computeSummary(tasks: PrepTask[], date: string): PrepSummary {
  const s: PrepSummary = {
    date,
    total: tasks.length,
    pending: 0,
    inProgress: 0,
    done: 0,
    skipped: 0,
  };
  for (const t of tasks) {
    if (t.status === 'pending') s.pending++;
    else if (t.status === 'in_progress') s.inProgress++;
    else if (t.status === 'done') s.done++;
    else if (t.status === 'skipped') s.skipped++;
  }
  return s;
}

export function PrepListClient({ tenantId, userRole }: Props) {
  const [date, setDate] = useState<string>(todayISO());
  const [tasks, setTasks] = useState<PrepTask[]>([]);
  const [summary, setSummary] = useState<PrepSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<PrepTask | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, s] = await Promise.all([
        getPrepTasksForDate(tenantId, date),
        getPrepSummary(tenantId, date),
      ]);
      setTasks(t);
      setSummary(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה לא ידועה');
    } finally {
      setLoading(false);
    }
  }, [tenantId, date]);

  useEffect(() => {
    load();
  }, [load]);

  function applyTaskUpdate(updated: PrepTask) {
    setTasks((prev) => {
      const next = prev.map((t) => (t.id === updated.id ? updated : t));
      setSummary(computeSummary(next, date));
      return next;
    });
  }

  async function handleStatusChange(task: PrepTask, status: PrepTaskStatus) {
    const prevTasks = tasks;
    const optimistic: PrepTask = { ...task, status };
    applyTaskUpdate(optimistic);
    try {
      const updated = await updatePrepTaskStatus(tenantId, task.id, { status });
      applyTaskUpdate(updated);
    } catch (err) {
      setTasks(prevTasks);
      setSummary(computeSummary(prevTasks, date));
      toast.error(err instanceof Error ? err.message : 'שגיאה בעדכון סטטוס');
    }
  }

  async function handleQtyBlur(task: PrepTask, raw: string) {
    const trimmed = raw.trim();
    const parsed = trimmed === '' ? null : Number(trimmed);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      toast.error('כמות חייבת להיות מספר חיובי');
      return;
    }
    if (parsed === task.qtyActual) return;
    const prevTasks = tasks;
    applyTaskUpdate({ ...task, qtyActual: parsed });
    try {
      const updated = await updatePrepTaskStatus(tenantId, task.id, {
        status: task.status,
        qtyActual: parsed,
      });
      applyTaskUpdate(updated);
    } catch (err) {
      setTasks(prevTasks);
      toast.error(err instanceof Error ? err.message : 'שגיאה בעדכון כמות');
    }
  }

  function openEdit(task: PrepTask) {
    setEditingTask(task);
    setDrawerOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="רשימת הכנות" subtitle="ניהול משימות הכנה יומיות" />

      {/* Date navigation */}
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDate(shiftDate(date, -1))}
        >
          <ChevronRight className="h-4 w-4" />
          אתמול
        </Button>
        <div className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium">
          <Calendar className="h-4 w-4" />
          {formatDateHe(date)}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDate(shiftDate(date, 1))}
        >
          מחר
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary */}
      {summary && !loading && !error && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">סה״כ: {summary.total}</Badge>
          <Badge className={STATUS_META.pending.badge}>
            ממתינות: {summary.pending}
          </Badge>
          <Badge className={STATUS_META.in_progress.badge}>
            בביצוע: {summary.inProgress}
          </Badge>
          <Badge className={STATUS_META.done.badge}>
            הושלמו: {summary.done}
          </Badge>
          {summary.skipped > 0 && (
            <Badge className={STATUS_META.skipped.badge}>
              דולגו: {summary.skipped}
            </Badge>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>מתכון</TableHead>
              <TableHead>כמות נדרשת</TableHead>
              <TableHead>כמות בפועל</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>הערות</TableHead>
              <TableHead className="w-16">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!loading && error && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-destructive text-sm">
                      שגיאה בטעינה. נסה שוב.
                    </p>
                    <Button variant="outline" size="sm" onClick={load}>
                      נסה שוב
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {!loading && !error && tasks.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <div className="text-muted-foreground flex flex-col items-center gap-3">
                    <Calendar className="h-10 w-10 opacity-60" />
                    <p className="text-sm">אין משימות הכנה לתאריך זה</p>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              !error &&
              tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">{task.recipeId}</TableCell>
                  <TableCell>
                    {task.qtyRequired} {task.unit}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      defaultValue={task.qtyActual ?? ''}
                      onBlur={(e) => handleQtyBlur(task, e.target.value)}
                      placeholder="—"
                      className="h-8 w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={task.status}
                      onValueChange={(v) =>
                        handleStatusChange(task, v as PrepTaskStatus)
                      }
                    >
                      <SelectTrigger
                        className={`h-8 w-32 border-0 ${STATUS_META[task.status].badge}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_META[s].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    {task.notes ? (
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="block truncate text-sm">
                              {task.notes}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            {task.notes}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(task)}
                      aria-label="ערוך משימה"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <PrepTaskDrawer
        tenantId={tenantId}
        userRole={userRole}
        task={editingTask}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSaved={applyTaskUpdate}
      />
    </div>
  );
}
