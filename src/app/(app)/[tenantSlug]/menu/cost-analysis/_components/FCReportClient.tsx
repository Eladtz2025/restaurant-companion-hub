'use client';

import { Sparkles } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

import { AIAssistantPanel } from './AIAssistantPanel';
import { FCReportTable } from './FCReportTable';

import type { FCReport } from '@/lib/food-cost/report';
import type { Role } from '@/lib/permissions';

interface Props {
  tenantId: string;
  tenantSlug: string;
  userRole: Role | null;
  initialReport: FCReport | null;
  initialError: string | null;
}

export function FCReportClient({
  tenantId,
  tenantSlug,
  userRole,
  initialReport,
  initialError,
}: Props) {
  const [report, setReport] = useState<FCReport | null>(initialReport);
  const [error, setError] = useState<string | null>(initialError);
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <div dir="rtl">
      <PageHeader title="ניתוח עלויות" subtitle="דוח Food Cost ועוזר ה-AI ליצירת מתכונים" />

      <div className="grid gap-6 md:grid-cols-10">
        <div className="md:col-span-7">
          <FCReportTable
            tenantId={tenantId}
            report={report}
            error={error}
            onReportChange={setReport}
            onErrorChange={setError}
          />
        </div>

        <aside className="hidden md:col-span-3 md:block">
          <AIAssistantPanel tenantId={tenantId} tenantSlug={tenantSlug} userRole={userRole} />
        </aside>
      </div>

      <div className="fixed bottom-4 left-4 z-30 md:hidden">
        <Sheet open={aiOpen} onOpenChange={setAiOpen}>
          <SheetTrigger asChild>
            <Button size="lg" className="rounded-full shadow-lg">
              <Sparkles className="ml-2 h-5 w-5" />
              עוזר AI
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto" dir="rtl">
            <AIAssistantPanel tenantId={tenantId} tenantSlug={tenantSlug} userRole={userRole} />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
