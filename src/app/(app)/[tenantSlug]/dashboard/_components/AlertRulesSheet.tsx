'use client';

import { Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { createAlertRule } from '@/lib/actions/dashboard';

import type { AlertOperator, AlertRule, AlertSeverity, KPIMetric } from '@/lib/types';

interface Props {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rules: AlertRule[];
  onRulesChange: (rules: AlertRule[]) => void;
}

const METRIC_LABEL: Record<KPIMetric, string> = {
  prep_completion_rate: 'אחוז השלמת הכנות',
  checklist_completion_rate: "אחוז השלמת צ'קליסטים",
  fc_percent: 'אחוז עלות מזון',
  active_recipes: 'מתכונים פעילים',
};

const OPERATOR_LABEL: Record<AlertOperator, string> = {
  lt: 'פחות מ',
  gt: 'גדול מ',
  lte: 'פחות מ או שווה ל',
  gte: 'גדול מ או שווה ל',
};

const OPERATOR_SYMBOL: Record<AlertOperator, string> = {
  lt: '<',
  gt: '>',
  lte: '≤',
  gte: '≥',
};

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  info: 'מידע',
  warning: 'אזהרה',
  critical: 'קריטי',
};

const SEVERITY_BADGE: Record<AlertSeverity, string> = {
  info: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  warning: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  critical: 'bg-red-100 text-red-800 hover:bg-red-100',
};

const METRIC_OPTIONS: KPIMetric[] = [
  'prep_completion_rate',
  'checklist_completion_rate',
  'fc_percent',
  'active_recipes',
];
const OPERATOR_OPTIONS: AlertOperator[] = ['lt', 'gt', 'lte', 'gte'];
const SEVERITY_OPTIONS: AlertSeverity[] = ['info', 'warning', 'critical'];

export function AlertRulesSheet({ tenantId, open, onOpenChange, rules, onRulesChange }: Props) {
  const [metric, setMetric] = useState<KPIMetric>('prep_completion_rate');
  const [operator, setOperator] = useState<AlertOperator>('lt');
  const [threshold, setThreshold] = useState<string>('');
  const [severity, setSeverity] = useState<AlertSeverity>('warning');
  const [pending, startTransition] = useTransition();

  function handleDelete(id: string) {
    onRulesChange(rules.filter((r) => r.id !== id));
  }

  function handleAdd() {
    const parsed = Number(threshold);
    if (threshold.trim() === '' || Number.isNaN(parsed)) {
      toast.error('סף חייב להיות מספר');
      return;
    }
    startTransition(async () => {
      try {
        const rule = await createAlertRule(tenantId, {
          metric,
          operator,
          threshold: parsed,
          severity,
        });
        onRulesChange([...rules, rule]);
        setThreshold('');
        toast.success('חוק נוסף');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'שגיאה ביצירת חוק');
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-6 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>ניהול חוקי התראות</SheetTitle>
          <SheetDescription>
            הגדר מתי המערכת תפתח התראה אוטומטית על סמך מדדים יומיים.
          </SheetDescription>
        </SheetHeader>

        {/* Rules list */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">חוקים פעילים</h3>
          {rules.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">אין חוקים פעילים</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rules.map((rule) => (
                <li key={rule.id} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                  <div className="flex-1">
                    <p className="font-medium">{METRIC_LABEL[rule.metric]}</p>
                    <p className="text-muted-foreground text-xs">
                      {OPERATOR_SYMBOL[rule.operator]} {rule.threshold}
                    </p>
                  </div>
                  <Badge className={SEVERITY_BADGE[rule.severity]}>
                    {SEVERITY_LABEL[rule.severity]}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(rule.id)}
                    aria-label="מחק חוק"
                  >
                    <Trash2 className="text-destructive h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Add form */}
        <div className="flex flex-col gap-3 rounded-md border p-4">
          <h3 className="text-sm font-semibold">הוסף חוק</h3>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">מדד</label>
            <Select value={metric} onValueChange={(v) => setMetric(v as KPIMetric)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METRIC_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {METRIC_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">אופרטור</label>
              <Select value={operator} onValueChange={(v) => setOperator(v as AlertOperator)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATOR_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {OPERATOR_SYMBOL[o]} {OPERATOR_LABEL[o]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">סף</label>
              <Input
                type="number"
                step="any"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">רמת חומרה</label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as AlertSeverity)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SEVERITY_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleAdd} disabled={pending}>
            {pending ? 'מוסיף…' : 'הוסף חוק'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
