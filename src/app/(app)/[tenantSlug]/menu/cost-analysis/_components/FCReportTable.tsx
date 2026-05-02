'use client';

import { AlertCircle, ArrowDown, ArrowUp, Download, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getFCReport } from '@/lib/actions/fc-report';

import type { FCReport, MenuItemFCRow } from '@/lib/food-cost/report';

const CATEGORY_LABEL: Record<string, string> = {
  appetizer: 'מנה ראשונה',
  main: 'עיקרית',
  dessert: 'קינוח',
  drink: 'שתייה',
  side: 'תוסף',
  special: 'מיוחד',
};

type SortKey =
  | 'nameHe'
  | 'category'
  | 'priceCents'
  | 'theoreticalCostCents'
  | 'fcPercent'
  | 'marginCents';

interface Props {
  tenantId: string;
  report: FCReport | null;
  error: string | null;
  onReportChange: (report: FCReport) => void;
  onErrorChange: (err: string | null) => void;
}

function fcBadge(row: MenuItemFCRow) {
  if (row.theoreticalCostCents <= 0) {
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground">
        אין נתונים
      </Badge>
    );
  }
  const pct = row.fcPercent;
  let cls = 'bg-green-100 text-green-800';
  if (pct >= 30 && pct <= 35) cls = 'bg-yellow-100 text-yellow-800';
  else if (pct > 35) cls = 'bg-red-100 text-red-800';
  return <Badge className={cls}>{pct.toFixed(1)}%</Badge>;
}

export function FCReportTable({ tenantId, report, error, onReportChange, onErrorChange }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('fcPercent');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [refreshing, setRefreshing] = useState(false);

  const sorted = useMemo(() => {
    if (!report) return [];
    const rows = [...report.rows];
    rows.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), 'he');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [report, sortKey, sortDir]);

  function setSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'fcPercent' ? 'desc' : 'asc');
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    onErrorChange(null);
    getFCReport(tenantId)
      .then((r) => {
        onReportChange(r);
        toast.success('הדוח רוענן');
      })
      .catch((e) => onErrorChange(e instanceof Error ? e.message : 'unknown'))
      .finally(() => setRefreshing(false));
  }

  function handlePdf() {
    toast.info('ייצוא PDF יהיה זמין בגרסה הבאה');
  }

  function header(label: string, key: SortKey) {
    const active = sortKey === key;
    return (
      <button
        type="button"
        onClick={() => setSort(key)}
        className="hover:text-foreground inline-flex items-center gap-1"
      >
        {label}
        {active &&
          (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    );
  }

  return (
    <div dir="rtl">
      <div className="bg-muted/40 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">FC ממוצע: </span>
            <span className="font-semibold">
              {report ? `${report.averageFcPercent.toFixed(1)}%` : '—'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">פריטים ללא עלות: </span>
            <span className="font-semibold">{report ? report.itemsWithMissingCosts : '—'}</span>
          </div>
        </div>
        <div className="flex flex-row-reverse items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`ml-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            רענן
          </Button>
          <Button variant="outline" size="sm" onClick={handlePdf}>
            <Download className="ml-2 h-4 w-4" />
            הורד PDF
          </Button>
        </div>
      </div>

      {error ? (
        <div className="border-destructive/40 bg-destructive/5 rounded-md border p-6 text-center">
          <p className="text-destructive mb-3 text-sm">שגיאה בטעינת הדוח</p>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            נסה שוב
          </Button>
        </div>
      ) : !report ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-muted-foreground rounded-md border p-10 text-center">
          לא נמצאו פריטי תפריט מקושרים למתכונים.
        </div>
      ) : (
        <TooltipProvider>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">{header('מנה', 'nameHe')}</TableHead>
                  <TableHead className="text-right">{header('קטגוריה', 'category')}</TableHead>
                  <TableHead className="text-right">{header('מחיר', 'priceCents')}</TableHead>
                  <TableHead className="text-right">
                    {header('עלות', 'theoreticalCostCents')}
                  </TableHead>
                  <TableHead className="text-right">{header('FC%', 'fcPercent')}</TableHead>
                  <TableHead className="text-right">{header('מרווח', 'marginCents')}</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => (
                  <TableRow key={row.menuItemId}>
                    <TableCell className="text-right font-medium">{row.nameHe}</TableCell>
                    <TableCell className="text-right">
                      {CATEGORY_LABEL[row.category] ?? row.category}
                    </TableCell>
                    <TableCell className="text-right">
                      {(row.priceCents / 100).toFixed(2)} ₪
                    </TableCell>
                    <TableCell className="text-right">
                      {row.theoreticalCostCents > 0
                        ? `${(row.theoreticalCostCents / 100).toFixed(2)} ₪`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">{fcBadge(row)}</TableCell>
                    <TableCell className="text-right">
                      {(row.marginCents / 100).toFixed(2)} ₪
                    </TableCell>
                    <TableCell className="text-right">
                      {row.missingCosts.length > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center text-yellow-700">
                              <AlertCircle className="h-4 w-4" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent dir="rtl" className="text-right">
                            <div className="text-xs font-medium">חסרות עלויות:</div>
                            <ul className="mt-1 text-xs">
                              {row.missingCosts.map((n) => (
                                <li key={n}>• {n}</li>
                              ))}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}
