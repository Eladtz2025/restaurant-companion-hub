import { CheckSquare, ClipboardList, Moon, Sun, Sunset, Sunrise } from 'lucide-react';
import { redirect } from 'next/navigation';

import { getAuthContext, createServerSupabaseClient } from '@/lib/supabase/server';
import { requireTenant } from '@/lib/tenant';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = { from: (table: string) => any };

type PageProps = { params: Promise<{ tenantSlug: string }> };

const SHIFTS = [
  { key: 'morning', label: 'בוקר', icon: Sunrise },
  { key: 'afternoon', label: 'צהריים', icon: Sun },
  { key: 'evening', label: 'ערב', icon: Sunset },
  { key: 'night', label: 'לילה', icon: Moon },
] as const;

function todayISO() {
  return new Date().toLocaleDateString('sv-SE');
}

export default async function FloorPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const tenant = await requireTenant(tenantSlug);
  const ctx = await getAuthContext();
  if (!ctx) redirect('/login');

  const today = todayISO();
  const supabase = await createServerSupabaseClient();
  const db = supabase as unknown as AnySupabase;

  const [checklistsRes, prepRes] = await Promise.all([
    db
      .from('checklist_completions')
      .select('status, shift')
      .eq('tenant_id', tenant.id)
      .eq('completion_date', today),
    supabase.from('prep_tasks').select('status').eq('tenant_id', tenant.id).eq('prep_date', today),
  ]);

  type CompRow = { status: string; shift: string };
  const completions: CompRow[] = checklistsRes.data ?? [];
  const prepTasks = prepRes.data ?? [];

  const prepDone = prepTasks.filter((t) => t.status === 'done').length;
  const prepTotal = prepTasks.length;
  const prepPct = prepTotal > 0 ? Math.round((prepDone / prepTotal) * 100) : null;

  const shiftStats = SHIFTS.map(({ key, label, icon: Icon }) => {
    const shiftCompletions = completions.filter((c) => c.shift === key);
    const done = shiftCompletions.filter((c) => c.status === 'completed').length;
    const total = shiftCompletions.length;
    return {
      key,
      label,
      Icon,
      done,
      total,
      pct: total > 0 ? Math.round((done / total) * 100) : null,
    };
  });

  return (
    <div className="space-y-8 py-2">
      <h1 className="text-2xl font-bold">ביצועי פלור</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-card rounded-xl border p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <ClipboardList className="text-muted-foreground h-4 w-4" />
            <p className="text-muted-foreground text-sm">Prep List — היום</p>
          </div>
          {prepPct !== null ? (
            <>
              <p className="text-3xl font-bold">{prepPct}%</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {prepDone} מתוך {prepTotal} משימות הושלמו
              </p>
              <div className="mt-3 h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className={`h-2 rounded-full transition-all ${prepPct >= 90 ? 'bg-green-500' : prepPct >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${prepPct}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm">אין נתונים להיום</p>
          )}
        </div>

        <div className="bg-card rounded-xl border p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <CheckSquare className="text-muted-foreground h-4 w-4" />
            <p className="text-muted-foreground text-sm">צ׳קליסטים — היום</p>
          </div>
          {completions.length > 0 ? (
            <>
              <p className="text-3xl font-bold">
                {Math.round(
                  (completions.filter((c) => c.status === 'completed').length /
                    completions.length) *
                    100,
                )}
                %
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {completions.filter((c) => c.status === 'completed').length} מתוך{' '}
                {completions.length} הושלמו
              </p>
            </>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm">אין נתונים להיום</p>
          )}
        </div>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold">ביצועי צ׳קליסט לפי משמרת</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {shiftStats.map(({ key, label, Icon, done, total, pct }) => (
            <div key={key} className="bg-card rounded-xl border p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Icon className="text-muted-foreground h-4 w-4" />
                <p className="text-sm font-medium">{label}</p>
              </div>
              {pct !== null ? (
                <>
                  <p className="text-2xl font-bold">{pct}%</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {done}/{total}
                  </p>
                  <div className="mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className={`h-1.5 rounded-full ${pct >= 90 ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">אין נתונים</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="bg-muted/40 rounded-xl border border-dashed p-6 text-center">
        <p className="text-muted-foreground text-sm font-medium">נתוני מכירות POS — בקרוב</p>
        <p className="text-muted-foreground mt-1 text-xs">
          חיבור ל-Tabit / OnTopo יאפשר מעקב מכירות, ממוצע סל, וזמני שיא
        </p>
      </div>
    </div>
  );
}
