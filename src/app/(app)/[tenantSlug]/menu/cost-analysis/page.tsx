import { getFCReport } from '@/lib/actions/fc-report';
import { getAuthContext } from '@/lib/supabase/server';
import { getUserRole, requireTenant } from '@/lib/tenant';

import { FCReportClient } from './_components/FCReportClient';

import type { Role } from '@/lib/permissions';

export default async function CostAnalysisPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await requireTenant(tenantSlug);
  const ctx = await getAuthContext();
  const role: Role | null = ctx ? await getUserRole(tenant.id, ctx.userId) : null;

  let initialReport: Awaited<ReturnType<typeof getFCReport>> | null = null;
  let initialError: string | null = null;
  try {
    initialReport = await getFCReport(tenant.id);
  } catch (err) {
    initialError = err instanceof Error ? err.message : 'unknown';
  }

  return (
    <FCReportClient
      tenantId={tenant.id}
      tenantSlug={tenantSlug}
      userRole={role}
      initialReport={initialReport}
      initialError={initialError}
    />
  );
}
