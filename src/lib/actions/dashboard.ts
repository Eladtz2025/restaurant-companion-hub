'use server';

import { z } from 'zod';

import { evaluateRules } from '@/lib/dashboard/kpis';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import type { ActivityItem } from '@/components/features/dashboard/ActivityFeed';
import type { Alert, AlertRule, AlertSeverity, KPIMetric, KPISnapshot } from '@/lib/types';

const ACTION_LABELS: Record<string, string> = {
  INSERT: 'נוצר',
  UPDATE: 'עודכן',
  DELETE: 'נמחק',
};

const TABLE_LABELS: Record<string, string> = {
  recipes: 'מתכון',
  menu_items: 'פריט תפריט',
  ingredients: 'מרכיב',
  prep_tasks: 'משימת Prep',
  checklist_completions: 'צ׳קליסט',
  memberships: 'חבר צוות',
};

export async function getRecentActivity(tenantId: string): Promise<ActivityItem[]> {
  const supabase = await createServerSupabaseClient();
  const db = supabase as unknown as AnySupabase;
  const { data } = await db
    .from('_audit_log')
    .select('id, action, table_name, new_data, created_at')
    .eq('new_data->>tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!data) return [];

  return (data as Record<string, unknown>[]).map((row) => {
    const action = ACTION_LABELS[(row.action as string) ?? ''] ?? row.action;
    const table = TABLE_LABELS[(row.table_name as string) ?? ''] ?? row.table_name;
    const newData = (row.new_data ?? {}) as Record<string, unknown>;
    const name =
      (newData.name as string | null) ??
      (newData.hebrew_name as string | null) ??
      (newData.item_text as string | null) ??
      '';
    const text = name ? `${table} "${name}" ${action}` : `${table} ${action}`;
    const ts = new Date(row.created_at as string);
    const timestamp = ts.toLocaleString('he-IL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    return { id: row.id as string, icon: null, text, timestamp };
  });
}

async function calcFcPercent(tenantId: string): Promise<number | null> {
  const supabase = await createServerSupabaseClient();
  const db = supabase as unknown as AnySupabase;

  const { data: items } = await db
    .from('menu_items')
    .select('price, recipe_id')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .not('recipe_id', 'is', null);

  if (!items || items.length === 0) return null;

  const recipeIds = (items as Record<string, unknown>[]).map((i) => i.recipe_id as string);

  const { data: components } = await supabase
    .from('recipe_components')
    .select('recipe_id, qty, ingredient_id')
    .in('recipe_id', recipeIds)
    .not('ingredient_id', 'is', null);

  if (!components || components.length === 0) return null;

  const ingredientIds = [...new Set(components.map((c) => c.ingredient_id as string))];
  const { data: ingredients } = await db
    .from('ingredients')
    .select('id, cost_per_unit')
    .in('id', ingredientIds);

  if (!ingredients) return null;

  const costMap = new Map(
    (ingredients as Record<string, unknown>[]).map((i) => [
      i.id as string,
      Number(i.cost_per_unit ?? 0),
    ]),
  );

  let totalCost = 0;
  let totalRevenue = 0;

  for (const item of items as Record<string, unknown>[]) {
    if (!item.recipe_id || !item.price) continue;
    const comps = (components as Record<string, unknown>[]).filter(
      (c) => c.recipe_id === item.recipe_id,
    );
    const recipeCost = comps.reduce(
      (sum, c) => sum + Number(c.qty) * (costMap.get(c.ingredient_id as string) ?? 0),
      0,
    );
    totalCost += recipeCost;
    totalRevenue += Number(item.price);
  }

  if (totalRevenue === 0) return null;
  return (totalCost / totalRevenue) * 100;
}

function rowToRule(row: Record<string, unknown>): AlertRule {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    metric: row.metric as KPIMetric,
    threshold: Number(row.threshold),
    operator: row.operator as AlertRule['operator'],
    severity: row.severity as AlertSeverity,
    active: row.active as boolean,
    createdAt: row.created_at as string,
  };
}

function rowToAlert(row: Record<string, unknown>): Alert {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    ruleId: (row.rule_id as string | null) ?? null,
    metric: row.metric as KPIMetric,
    value: Number(row.value),
    threshold: Number(row.threshold),
    severity: row.severity as AlertSeverity,
    message: row.message as string,
    acknowledged: row.acknowledged as boolean,
    acknowledgedBy: (row.acknowledged_by as string | null) ?? null,
    acknowledgedAt: (row.acknowledged_at as string | null) ?? null,
    firedAt: row.fired_at as string,
    date: row.date as string,
    createdAt: row.created_at as string,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = { from: (table: string) => any };

export async function getKPISnapshot(tenantId: string, date: string): Promise<KPISnapshot> {
  const supabase = await createServerSupabaseClient();
  const db = supabase as unknown as AnySupabase;

  const [prepRes, checklistRes, recipesRes, alertsRes, fcPercent] = await Promise.all([
    supabase.from('prep_tasks').select('status').eq('tenant_id', tenantId).eq('prep_date', date),
    supabase
      .from('checklist_completions')
      .select('status')
      .eq('tenant_id', tenantId)
      .eq('completion_date', date),
    supabase
      .from('recipes')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('active', true),
    db
      .from('alerts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('date', date)
      .eq('acknowledged', false),
    calcFcPercent(tenantId),
  ]);

  const prepTasks = prepRes.data ?? [];
  const prepDone = prepTasks.filter((t) => t.status === 'done').length;
  const prepTotal = prepTasks.length;
  const prepCompletionRate = prepTotal > 0 ? (prepDone / prepTotal) * 100 : 0;

  const completions = checklistRes.data ?? [];
  const checkDone = completions.filter((c) => c.status === 'completed').length;
  const checkTotal = completions.length;
  const checklistCompletionRate = checkTotal > 0 ? (checkDone / checkTotal) * 100 : 0;

  const activeRecipes = recipesRes.count ?? 0;
  const alerts = (alertsRes.data ?? []).map(rowToAlert);

  return {
    date,
    prepCompletionRate,
    checklistCompletionRate,
    fcPercent,
    activeRecipes,
    alerts,
  };
}

export async function getAlertRules(tenantId: string): Promise<AlertRule[]> {
  const supabase = await createServerSupabaseClient();
  const db = supabase as unknown as AnySupabase;
  const { data, error } = await db
    .from('alert_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('created_at');
  if (error) throw new Error(error.message);
  return ((data as Record<string, unknown>[] | null) ?? []).map(rowToRule);
}

const AlertRuleSchema = z.object({
  metric: z.enum([
    'prep_completion_rate',
    'checklist_completion_rate',
    'fc_percent',
    'active_recipes',
  ]),
  threshold: z.number(),
  operator: z.enum(['lt', 'gt', 'lte', 'gte']),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
});

export async function createAlertRule(
  tenantId: string,
  data: {
    metric: KPIMetric;
    threshold: number;
    operator: AlertRule['operator'];
    severity?: AlertSeverity;
  },
): Promise<AlertRule> {
  const validated = AlertRuleSchema.parse(data);
  const supabase = await createServerSupabaseClient();
  const db = supabase as unknown as AnySupabase;
  const { data: row, error } = await db
    .from('alert_rules')
    .insert({
      tenant_id: tenantId,
      metric: validated.metric,
      threshold: validated.threshold,
      operator: validated.operator,
      severity: validated.severity ?? 'warning',
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToRule(row as Record<string, unknown>);
}

export async function acknowledgeAlert(
  tenantId: string,
  alertId: string,
  userId: string,
): Promise<Alert> {
  const supabase = await createServerSupabaseClient();
  const db = supabase as unknown as AnySupabase;
  const { data: row, error } = await db
    .from('alerts')
    .update({
      acknowledged: true,
      acknowledged_by: userId,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', alertId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToAlert(row as Record<string, unknown>);
}

export async function fireAlertsForSnapshot(
  tenantId: string,
  snapshot: KPISnapshot,
): Promise<Alert[]> {
  const rules = await getAlertRules(tenantId);
  const fired = evaluateRules(rules, snapshot);
  if (fired.length === 0) return [];

  const supabase = await createServerSupabaseClient();
  const db = supabase as unknown as AnySupabase;
  const rows = fired.map((f) => ({
    tenant_id: tenantId,
    metric: f.metric,
    value: f.value,
    threshold: f.threshold,
    severity: f.severity,
    message: f.message,
    date: f.date,
  }));
  const { data, error } = await db.from('alerts').insert(rows).select();
  if (error) throw new Error(error.message);
  return ((data as Record<string, unknown>[] | null) ?? []).map(rowToAlert);
}
