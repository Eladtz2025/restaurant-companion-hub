import { AlertCircle, CheckSquare, ClipboardList, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ActivityFeed } from '@/components/features/dashboard/ActivityFeed';
import { EmptyState } from '@/components/features/dashboard/EmptyState';
import { KPICard } from '@/components/features/dashboard/KPICard';
import { getKPISnapshot, getRecentActivity } from '@/lib/actions/dashboard';
import { getAuthContext } from '@/lib/supabase/server';
import { getUserRole, requireTenant } from '@/lib/tenant';

type PageProps = { params: Promise<{ tenantSlug: string }> };

function todayISO() {
  return new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD in local time
}

export default async function HomePage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const tenant = await requireTenant(tenantSlug);
  const ctx = await getAuthContext();
  if (!ctx) redirect('/login');

  const userRole = await getUserRole(tenant.id, ctx.userId);
  const today = todayISO();

  const [snapshot, activity] = await Promise.all([
    getKPISnapshot(tenant.id, today),
    getRecentActivity(tenant.id),
  ]);

  if (userRole === 'owner' || userRole === 'manager') {
    return (
      <OwnerManagerDashboard snapshot={snapshot} activity={activity} tenantSlug={tenantSlug} />
    );
  }

  if (userRole === 'chef') {
    return <ChefDashboard tenantSlug={tenantSlug} prepPct={snapshot.prepCompletionRate} />;
  }

  return <StaffDashboard />;
}

function OwnerManagerDashboard({
  snapshot,
  activity,
  tenantSlug,
}: {
  snapshot: Awaited<ReturnType<typeof getKPISnapshot>>;
  activity: Awaited<ReturnType<typeof getRecentActivity>>;
  tenantSlug: string;
}) {
  const prepTrend =
    snapshot.prepCompletionRate >= 90
      ? 'up'
      : snapshot.prepCompletionRate >= 70
        ? 'neutral'
        : 'down';
  const checkTrend =
    snapshot.checklistCompletionRate >= 90
      ? 'up'
      : snapshot.checklistCompletionRate >= 70
        ? 'neutral'
        : 'down';
  const fcTrend =
    snapshot.fcPercent === null
      ? 'neutral'
      : snapshot.fcPercent <= 30
        ? 'up'
        : snapshot.fcPercent <= 35
          ? 'neutral'
          : 'down';

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">בית</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="השלמת Prep"
          value={`${Math.round(snapshot.prepCompletionRate)}%`}
          trend={prepTrend}
        />
        <KPICard
          title="השלמת צ'קליסט"
          value={`${Math.round(snapshot.checklistCompletionRate)}%`}
          trend={checkTrend}
        />
        <KPICard
          title="Food Cost %"
          value={snapshot.fcPercent !== null ? `${snapshot.fcPercent.toFixed(1)}%` : '—'}
          trend={fcTrend}
        />
        <KPICard title="מתכונים פעילים" value={String(snapshot.activeRecipes)} trend="neutral" />
      </div>

      {snapshot.alerts.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">התראות פעילות</h2>
          <div className="flex flex-col gap-2">
            {snapshot.alerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  alert.severity === 'critical'
                    ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950'
                    : alert.severity === 'warning'
                      ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950'
                      : 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950'
                }`}
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-sm">{alert.message}</p>
              </div>
            ))}
          </div>
          <Link
            href={`/${tenantSlug}/dashboard`}
            className="text-muted-foreground mt-2 block text-xs hover:underline"
          >
            לדשבורד המלא ←
          </Link>
        </section>
      )}

      {snapshot.alerts.length === 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">התראות</h2>
          <EmptyState icon={AlertCircle} title="אין התראות" subtitle="הכל תקין" />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">פעילות אחרונה</h2>
        <ActivityFeed items={activity} />
      </section>
    </div>
  );
}

function ChefDashboard({ tenantSlug, prepPct }: { tenantSlug: string; prepPct: number }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">בית</h1>

      <Link
        href={`/${tenantSlug}/prep`}
        className="bg-card hover:bg-accent flex items-center gap-4 rounded-xl border p-5 shadow-sm transition-colors"
      >
        <ClipboardList className="h-8 w-8 shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">Prep List להיום</p>
          <p className="text-muted-foreground text-sm">
            {prepPct > 0 ? `${Math.round(prepPct)}% הושלם` : 'צפה ועדכן את רשימת ה-Prep'}
          </p>
        </div>
        {prepPct > 0 && (
          <span
            className={`text-sm font-bold ${prepPct >= 90 ? 'text-green-600' : prepPct >= 70 ? 'text-yellow-600' : 'text-red-500'}`}
          >
            {Math.round(prepPct)}%
          </span>
        )}
      </Link>

      <Link
        href={`/${tenantSlug}/checklists`}
        className="bg-card hover:bg-accent flex items-center gap-4 rounded-xl border p-5 shadow-sm transition-colors"
      >
        <CheckSquare className="h-8 w-8 shrink-0" />
        <div>
          <p className="font-semibold">צ׳קליסט משמרת</p>
          <p className="text-muted-foreground text-sm">בדוק ואשר את צ׳קליסט המשמרת</p>
        </div>
      </Link>

      <button className="bg-card hover:bg-accent flex cursor-not-allowed items-center gap-4 rounded-xl border p-5 text-start opacity-50 shadow-sm transition-colors">
        <Trash2 className="text-destructive h-8 w-8 shrink-0" />
        <div>
          <p className="font-semibold">דווח Waste</p>
          <p className="text-muted-foreground text-sm">בקרוב</p>
        </div>
      </button>
    </div>
  );
}

function StaffDashboard() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">בית</h1>
      <section>
        <h2 className="mb-3 text-lg font-semibold">נהלים לחתימה</h2>
        <EmptyState
          icon={ClipboardList}
          title="אין נהלים חדשים"
          subtitle="נהלים שדורשים חתימה יופיעו כאן"
        />
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">משימות שלי</h2>
        <EmptyState icon={CheckSquare} title="אין משימות" subtitle="משימות שהוקצו לך יופיעו כאן" />
      </section>
    </div>
  );
}
