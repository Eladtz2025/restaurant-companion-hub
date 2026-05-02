'use client';

import {
  AlertTriangle,
  BellOff,
  BookOpen,
  CheckSquare,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Info,
  TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { IfRole } from '@/components/shared/IfRole';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  acknowledgeAlert,
  getAlertRules,
  getKPISnapshot,
} from '@/lib/actions/dashboard';
import { cn } from '@/lib/utils';

import { AlertRulesSheet } from './AlertRulesSheet';

import type { Role } from '@/lib/permissions';
import type {
  Alert,
  AlertRule,
  AlertSeverity,
  KPISnapshot,
} from '@/lib/types';

interface Props {
  tenantId: string;
  tenantSlug: string;
  userRole: Role | null;
  userId: string | null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function shiftDate(iso: string, days: number) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
const dateFormatter = new Intl.DateTimeFormat('he-IL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
function formatDateHe(iso: string) {
  return dateFormatter.format(new Date(iso + 'T00:00:00'));
}

function rateColor(n: number) {
  if (n >= 80) return 'text-green-600';
  if (n >= 60) return 'text-yellow-600';
  return 'text-red-600';
}
function fcColor(n: number | null) {
  if (n === null) return 'text-muted-foreground';
  if (n < 30) return 'text-green-600';
  if (n <= 35) return 'text-yellow-600';
  return 'text-red-600';
}

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

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

function KPICardItem({
  title,
  value,
  icon: Icon,
  colorClass,
  loading,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {title}
        </CardTitle>
        <Icon className={cn('h-5 w-5', colorClass)} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-9 w-24" />
        ) : (
          <p className={cn('text-3xl font-bold', colorClass)}>{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function severityIcon(sev: AlertSeverity) {
  if (sev === 'critical')
    return <AlertTriangle className="text-red-600 h-5 w-5 shrink-0" />;
  if (sev === 'warning')
    return <AlertTriangle className="text-yellow-600 h-5 w-5 shrink-0" />;
  return <Info className="text-blue-600 h-5 w-5 shrink-0" />;
}

export function DashboardClient({
  tenantId,
  userRole,
  userId,
}: Props) {
  const [date, setDate] = useState<string>(todayISO());
  const [snapshot, setSnapshot] = useState<KPISnapshot | null>(null);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [snap, r] = await Promise.all([
        getKPISnapshot(tenantId, date),
        getAlertRules(tenantId),
      ]);
      setSnapshot(snap);
      setRules(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה לא ידועה');
    } finally {
      setLoading(false);
    }
  }, [tenantId, date]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAck(alert: Alert) {
    if (!userId) {
      toast.error('משתמש לא מזוהה');
      return;
    }
    const prev = snapshot;
    if (!prev) return;
    setSnapshot({
      ...prev,
      alerts: prev.alerts.filter((a) => a.id !== alert.id),
    });
    try {
      await acknowledgeAlert(tenantId, alert.id, userId);
    } catch (err) {
      setSnapshot(prev);
      toast.error(err instanceof Error ? err.message : 'שגיאה באישור התראה');
    }
  }

  const alerts = (snapshot?.alerts ?? [])
    .slice()
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;
  const countBadgeClass =
    criticalCount > 0
      ? 'bg-red-100 text-red-800 hover:bg-red-100'
      : warningCount > 0
        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-100';

  const dateActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setDate(shiftDate(date, -1))}
        aria-label="יום קודם"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <div className="rounded-md border px-3 py-1.5 text-sm font-medium">
        {formatDateHe(date)}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setDate(shiftDate(date, 1))}
        aria-label="יום הבא"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="לוח בקרה" subtitle="סקירה יומית של מדדים והתראות" actions={dateActions} />

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          שגיאה בטעינה. נסה שוב.{' '}
          <Button variant="outline" size="sm" onClick={load} className="ms-2">
            נסה שוב
          </Button>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICardItem
          title="השלמת הכנות"
          value={`${(snapshot?.prepCompletionRate ?? 0).toFixed(1)}%`}
          icon={ChefHat}
          colorClass={rateColor(snapshot?.prepCompletionRate ?? 0)}
          loading={loading}
        />
        <KPICardItem
          title="השלמת צ'קליסטים"
          value={`${(snapshot?.checklistCompletionRate ?? 0).toFixed(1)}%`}
          icon={CheckSquare}
          colorClass={rateColor(snapshot?.checklistCompletionRate ?? 0)}
          loading={loading}
        />
        <KPICardItem
          title="עלות מזון"
          value={
            snapshot?.fcPercent != null
              ? `${snapshot.fcPercent.toFixed(1)}%`
              : '—'
          }
          icon={TrendingUp}
          colorClass={fcColor(snapshot?.fcPercent ?? null)}
          loading={loading}
        />
        <KPICardItem
          title="מתכונים פעילים"
          value={`${snapshot?.activeRecipes ?? 0}`}
          icon={BookOpen}
          colorClass="text-foreground"
          loading={loading}
        />
      </div>

      {/* Alerts panel */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">התראות פעילות</CardTitle>
            {alerts.length > 0 && (
              <Badge className={countBadgeClass}>{alerts.length}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-8">
              <BellOff className="text-green-600 h-10 w-10" />
              <p className="text-sm">אין התראות פעילות</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-md border p-3"
                >
                  {severityIcon(a.severity)}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{a.message}</p>
                    <p className="text-muted-foreground text-xs">
                      {relativeTimeHe(a.firedAt)}
                    </p>
                  </div>
                  <IfRole userRole={userRole} roles={['owner', 'manager']}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAck(a)}
                    >
                      אשר
                    </Button>
                  </IfRole>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Manage rules */}
      <IfRole userRole={userRole} roles={['owner', 'manager']}>
        <div>
          <Button variant="outline" onClick={() => setRulesOpen(true)}>
            ניהול חוקי התראות
          </Button>
        </div>
      </IfRole>

      <AlertRulesSheet
        tenantId={tenantId}
        open={rulesOpen}
        onOpenChange={setRulesOpen}
        rules={rules}
        onRulesChange={setRules}
      />
    </div>
  );
}
