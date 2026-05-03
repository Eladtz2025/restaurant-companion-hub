import { ExternalLink, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getKPISnapshot } from '@/lib/actions/dashboard';
import { getAuthContext } from '@/lib/supabase/server';
import { requireTenant } from '@/lib/tenant';

type PageProps = { params: Promise<{ tenantSlug: string }> };

function todayISO() {
  return new Date().toLocaleDateString('sv-SE');
}

export default async function FinancePage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const tenant = await requireTenant(tenantSlug);
  const ctx = await getAuthContext();
  if (!ctx) redirect('/login');

  const snapshot = await getKPISnapshot(tenant.id, todayISO());
  const fc = snapshot.fcPercent;
  const fcColor =
    fc === null ? '' : fc <= 28 ? 'text-green-600' : fc <= 35 ? 'text-yellow-600' : 'text-red-500';

  return (
    <div className="space-y-8 py-2">
      <h1 className="text-2xl font-bold">פיננסי</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-card rounded-xl border p-5 shadow-sm">
          <p className="text-muted-foreground mb-1 text-sm">Food Cost % (תיאורטי)</p>
          <p className={`text-3xl font-bold ${fcColor}`}>
            {fc !== null ? `${fc.toFixed(1)}%` : '—'}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {fc !== null
              ? fc <= 28
                ? 'מצוין — מתחת ל-28%'
                : fc <= 35
                  ? 'סביר — יש מקום לשיפור'
                  : 'גבוה — בדוק מחירי מרכיבים'
              : 'חסרים מתכונים מקושרים לתפריט'}
          </p>
        </div>

        <div className="bg-card rounded-xl border p-5 opacity-50 shadow-sm">
          <p className="text-muted-foreground mb-1 text-sm">מכירות יומיות</p>
          <p className="text-3xl font-bold">—</p>
          <p className="text-muted-foreground mt-1 text-xs">דורש חיבור POS</p>
        </div>

        <div className="bg-card rounded-xl border p-5 opacity-50 shadow-sm">
          <p className="text-muted-foreground mb-1 text-sm">רווח גולמי</p>
          <p className="text-3xl font-bold">—</p>
          <p className="text-muted-foreground mt-1 text-xs">דורש חיבור POS</p>
        </div>
      </div>

      <section className="bg-card rounded-xl border shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-base font-semibold">ניתוח עלות מזון מפורט</h2>
          <Link
            href={`/${tenantSlug}/menu/cost-analysis`}
            className="text-primary flex items-center gap-1 text-sm hover:underline"
          >
            פתח דוח <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="px-6 py-4">
          <p className="text-muted-foreground text-sm">
            דוח עלות מזון מפורט לפי מנה — עלות תיאורטית, אחוז FC, וניתוח כדאיות.
          </p>
        </div>
      </section>

      <div className="bg-muted/40 rounded-xl border border-dashed p-6 text-center">
        <TrendingUp className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
        <p className="text-muted-foreground text-sm font-medium">דוחות פיננסיים מתקדמים — בקרוב</p>
        <p className="text-muted-foreground mt-1 text-xs">P&L, תחזית, ניתוח מגמות לאורך זמן</p>
      </div>
    </div>
  );
}
