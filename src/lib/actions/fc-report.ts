'use server';

import { unstable_cache } from 'next/cache';

import { buildFCReport } from '@/lib/food-cost/report';

import type { FCReport } from '@/lib/food-cost/report';

export async function getFCReport(tenantId: string): Promise<FCReport> {
  const cached = unstable_cache(
    () => buildFCReport(tenantId),
    [`fc-report-${tenantId}`],
    { revalidate: 300 }, // 5 minutes
  );
  return cached();
}

export async function invalidateFCReportCache(tenantId: string): Promise<void> {
  const { revalidateTag } = await import('next/cache');
  revalidateTag(`fc-report-${tenantId}`);
}
