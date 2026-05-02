'use server';

import type {
  Alert,
  AlertOperator,
  AlertRule,
  AlertSeverity,
  KPIMetric,
  KPISnapshot,
} from '@/lib/types';

/**
 * STUB. In-memory dashboard data for development. The orchestrator phase
 * replaces this with real DB queries / aggregation.
 */

type Store = {
  snapshots: Map<string, KPISnapshot>; // key: tenantId:date
  rules: Map<string, AlertRule[]>; // key: tenantId
};

const store: Store = {
  snapshots: new Map(),
  rules: new Map(),
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function snapKey(tenantId: string, date: string) {
  return `${tenantId}:${date}`;
}

function seedSnapshot(tenantId: string, date: string): KPISnapshot {
  if (date !== todayISO()) {
    return {
      date,
      prepCompletionRate: 0,
      checklistCompletionRate: 0,
      fcPercent: null,
      activeRecipes: 0,
      alerts: [],
    };
  }
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
  return {
    date,
    prepCompletionRate: 75,
    checklistCompletionRate: 92.5,
    fcPercent: 36.2,
    activeRecipes: 18,
    alerts: [
      {
        id: 'alert_fc_1',
        metric: 'fc_percent',
        value: 36.2,
        threshold: 35,
        severity: 'critical',
        message: 'אחוז עלות מזון חצה את הסף הקריטי (36.2% > 35%)',
        acknowledged: false,
        firedAt: thirtyMinAgo,
        date,
      },
      {
        id: 'alert_prep_1',
        metric: 'prep_completion_rate',
        value: 75,
        threshold: 80,
        severity: 'warning',
        message: 'אחוז השלמת הכנות מתחת לסף (75% < 80%)',
        acknowledged: false,
        firedAt: twoHoursAgo,
        date,
      },
    ],
  };
}

function seedRules(): AlertRule[] {
  return [
    {
      id: 'rule_1',
      metric: 'prep_completion_rate',
      threshold: 80,
      operator: 'lt',
      severity: 'warning',
      active: true,
    },
    {
      id: 'rule_2',
      metric: 'fc_percent',
      threshold: 35,
      operator: 'gt',
      severity: 'critical',
      active: true,
    },
  ];
}

function ensureSnapshot(tenantId: string, date: string): KPISnapshot {
  const k = snapKey(tenantId, date);
  if (!store.snapshots.has(k)) store.snapshots.set(k, seedSnapshot(tenantId, date));
  return store.snapshots.get(k)!;
}

function ensureRules(tenantId: string): AlertRule[] {
  if (!store.rules.has(tenantId)) store.rules.set(tenantId, seedRules());
  return store.rules.get(tenantId)!;
}

export async function getKPISnapshot(
  tenantId: string,
  date: string,
): Promise<KPISnapshot> {
  const snap = ensureSnapshot(tenantId, date);
  return {
    ...snap,
    alerts: snap.alerts.filter((a) => !a.acknowledged).map((a) => ({ ...a })),
  };
}

export async function getAlertRules(tenantId: string): Promise<AlertRule[]> {
  return ensureRules(tenantId).map((r) => ({ ...r }));
}

export async function createAlertRule(
  tenantId: string,
  data: {
    metric: KPIMetric;
    threshold: number;
    operator: AlertOperator;
    severity?: AlertSeverity;
  },
): Promise<AlertRule> {
  const rules = ensureRules(tenantId);
  const rule: AlertRule = {
    id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    metric: data.metric,
    threshold: data.threshold,
    operator: data.operator,
    severity: data.severity ?? 'warning',
    active: true,
  };
  rules.push(rule);
  return { ...rule };
}

export async function acknowledgeAlert(
  tenantId: string,
  alertId: string,
  _userId: string,
): Promise<Alert> {
  for (const [k, snap] of store.snapshots.entries()) {
    if (!k.startsWith(`${tenantId}:`)) continue;
    const idx = snap.alerts.findIndex((a) => a.id === alertId);
    if (idx === -1) continue;
    const next: Alert = { ...snap.alerts[idx]!, acknowledged: true };
    snap.alerts[idx] = next;
    return { ...next };
  }
  throw new Error('Alert not found');
}
