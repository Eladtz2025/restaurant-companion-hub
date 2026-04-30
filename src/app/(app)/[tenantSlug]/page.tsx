'use client';

import { AlertCircle, CheckSquare, ClipboardList, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import { ActivityFeed } from '@/components/features/dashboard/ActivityFeed';
import { EmptyState } from '@/components/features/dashboard/EmptyState';
import { KPICard } from '@/components/features/dashboard/KPICard';
import { useTenant } from '@/contexts/TenantContext';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

export default function HomePage() {
  const { tenantId, tenantSlug, userRole } = useTenant();

  // Realtime subscription placeholder — proves channel works before Phase 4+.
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`dashboard:${tenantId}`)
      .on('broadcast', { event: '*' }, (payload) => {
        console.log('[dashboard realtime]', payload);
      })
      .subscribe((status) => {
        console.log('[dashboard realtime status]', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  if (userRole === 'owner' || userRole === 'manager') {
    return <OwnerManagerDashboard />;
  }

  if (userRole === 'chef') {
    return <ChefDashboard tenantSlug={tenantSlug} />;
  }

  return <StaffDashboard />;
}

function OwnerManagerDashboard() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">בית</h1>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard title="מכירות אתמול" value="₪12,450" unit="ש״ח" trend="up" />
        <KPICard title="Food Cost %" value="27.8%" trend="neutral" />
        <KPICard title="Prep %" value="94%" trend="up" />
        <KPICard title="Waste" value="₪320" unit="ש״ח" trend="down" />
      </div>

      {/* Open tasks */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">משימות פתוחות</h2>
        <EmptyState icon={CheckSquare} title="אין משימות פתוחות 🎉" subtitle="כל המשימות הושלמו" />
      </section>

      {/* Activity feed */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">פעילות אחרונה</h2>
        <ActivityFeed />
      </section>

      {/* Alerts */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">התראות</h2>
        <EmptyState icon={AlertCircle} title="אין התראות" subtitle="התראות חשובות יופיעו כאן" />
      </section>
    </div>
  );
}

function ChefDashboard({ tenantSlug }: { tenantSlug: string }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">בית</h1>

      <Link
        href={`/${tenantSlug}/prep`}
        className="bg-card hover:bg-accent flex items-center gap-4 rounded-xl border p-5 shadow-sm transition-colors"
      >
        <ClipboardList className="h-8 w-8 shrink-0" />
        <div>
          <p className="font-semibold">Prep List להיום</p>
          <p className="text-muted-foreground text-sm">צפה ועדכן את רשימת ה-Prep</p>
        </div>
      </Link>

      <Link
        href={`/${tenantSlug}/checklist`}
        className="bg-card hover:bg-accent flex items-center gap-4 rounded-xl border p-5 shadow-sm transition-colors"
      >
        <CheckSquare className="h-8 w-8 shrink-0" />
        <div>
          <p className="font-semibold">צ׳קליסט משמרת</p>
          <p className="text-muted-foreground text-sm">בדוק ואשר את צ׳קליסט המשמרת</p>
        </div>
      </Link>

      <button className="bg-card hover:bg-accent flex items-center gap-4 rounded-xl border p-5 text-start shadow-sm transition-colors">
        <Trash2 className="text-destructive h-8 w-8 shrink-0" />
        <div>
          <p className="font-semibold">דווח Waste</p>
          <p className="text-muted-foreground text-sm">דווח על בזבוז ממזון</p>
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
