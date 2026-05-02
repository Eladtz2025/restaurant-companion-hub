import { createClient } from '@supabase/supabase-js';

import { logger } from '@/lib/observability';
import { generateDailyPrepTasks } from '@/lib/prep/daily-generator';

import { inngest } from '../client';

// 02:30 UTC daily = 04:30 IST, before morning prep shift
const CRON = '30 2 * * *';

// Service-role Supabase client (bypasses RLS — only safe in server-side jobs)
function makeServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

// ── per-tenant handler (triggered by event) ──────────────────────────────
export const generatePrepForTenant = inngest.createFunction(
  {
    id: 'generate-prep-for-tenant',
    retries: 3,
    concurrency: { limit: 5 }, // max 5 tenants at once
    triggers: [{ event: 'prep/daily.generate.requested' as const }],
  },
  async ({ event, step }) => {
    const { tenantId, targetDate } = event.data;

    // 1. Fetch active prep recipes for the tenant
    const recipes = await step.run('fetch-recipes', async () => {
      const db = makeServiceClient();
      const { data, error } = await db
        .from('recipes')
        .select('id, yield_unit')
        .eq('tenant_id', tenantId)
        .eq('type', 'prep')
        .eq('active', true);
      if (error) throw new Error(error.message);
      return data ?? [];
    });

    if (recipes.length === 0) {
      return { tasksCreated: 0, skipped: 0 };
    }

    // 2. Build sales history from last 14 days of qty_actual on prep_tasks
    const salesHistory = await step.run('fetch-history', async () => {
      const db = makeServiceClient();
      const from = new Date();
      from.setDate(from.getDate() - 14);
      const fromStr = from.toISOString().slice(0, 10);

      const { data, error } = await db
        .from('prep_tasks')
        .select('recipe_id, prep_date, qty_actual')
        .eq('tenant_id', tenantId)
        .gte('prep_date', fromStr)
        .lt('prep_date', targetDate)
        .not('qty_actual', 'is', null);

      if (error) throw new Error(error.message);
      return data ?? [];
    });

    // 3. Generate forecast
    const historyMap = new Map<string, Array<{ date: string; qty: number }>>();
    const unitMap = new Map<string, string>();
    for (const r of recipes) {
      historyMap.set(r.id, []);
      unitMap.set(r.id, r.yield_unit ?? 'unit');
    }
    for (const row of salesHistory) {
      const pts = historyMap.get(row.recipe_id);
      if (pts) pts.push({ date: row.prep_date, qty: Number(row.qty_actual) });
    }

    const { tasks, skipped } = generateDailyPrepTasks({
      tenantId,
      targetDate,
      salesHistory: historyMap,
      recipeUnits: unitMap,
    });

    // 4. Recipes with no history → add placeholder tasks (qty 0) so managers can fill in
    const recipeIdsWithTasks = new Set(tasks.map((t) => t.recipeId));
    for (const r of recipes) {
      if (!recipeIdsWithTasks.has(r.id)) {
        tasks.push({
          recipeId: r.id,
          prepDate: targetDate,
          qtyRequired: 0,
          unit: r.yield_unit ?? 'unit',
        });
      }
    }

    // 5. Upsert prep tasks via service client
    const created = await step.run('upsert-tasks', async () => {
      if (tasks.length === 0) return 0;
      const db = makeServiceClient();
      const rows = tasks.map((t) => ({
        tenant_id: tenantId,
        recipe_id: t.recipeId,
        prep_date: t.prepDate,
        qty_required: t.qtyRequired,
        unit: t.unit,
      }));
      const { error } = await db
        .from('prep_tasks')
        .upsert(rows, { onConflict: 'tenant_id,recipe_id,prep_date', ignoreDuplicates: true });
      if (error) throw new Error(error.message);
      return rows.length;
    });

    logger.info({
      action: 'prep.daily.generated',
      tenantId,
      targetDate,
      created,
      skipped: skipped.length,
    });

    await step.sendEvent('notify-completed', {
      name: 'prep/daily.generation.completed',
      data: { tenantId, targetDate, tasksCreated: created, skipped: skipped.length },
    });

    return { tasksCreated: created, skipped: skipped.length };
  },
);

// ── daily cron: fires one event per active tenant ─────────────────────────
export const dailyPrepCron = inngest.createFunction(
  {
    id: 'daily-prep-cron',
    retries: 2,
    triggers: [{ cron: CRON }],
  },
  async ({ step }) => {
    // Target date = tomorrow (prep is done the day before)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const targetDate = tomorrow.toISOString().slice(0, 10);

    // Fetch all active tenants
    const tenants = await step.run('fetch-tenants', async () => {
      const db = makeServiceClient();
      const { data, error } = await db.from('tenants').select('id').eq('active', true);
      if (error) throw new Error(error.message);
      return (data ?? []).map((t: { id: string }) => t.id);
    });

    // Fire one event per tenant (fan-out)
    if (tenants.length > 0) {
      await step.sendEvent(
        'fan-out',
        tenants.map((tenantId: string) => ({
          name: 'prep/daily.generate.requested' as const,
          data: { tenantId, targetDate },
        })),
      );
    }

    logger.info({ action: 'prep.cron.fired', targetDate, tenantCount: tenants.length });
    return { targetDate, tenantCount: tenants.length };
  },
);
