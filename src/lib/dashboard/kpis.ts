import type { Alert, AlertOperator, AlertRule, KPIMetric, KPISnapshot } from '@/lib/types';

export function evalThreshold(value: number, operator: AlertOperator, threshold: number): boolean {
  switch (operator) {
    case 'lt':
      return value < threshold;
    case 'gt':
      return value > threshold;
    case 'lte':
      return value <= threshold;
    case 'gte':
      return value >= threshold;
  }
}

export function buildAlertMessage(
  metric: KPIMetric,
  value: number,
  threshold: number,
  operator: AlertOperator,
): string {
  const metricLabels: Record<KPIMetric, string> = {
    prep_completion_rate: 'אחוז השלמת הכנות',
    checklist_completion_rate: "אחוז השלמת צ'קליסטים",
    fc_percent: 'אחוז עלות מזון',
    active_recipes: 'מתכונים פעילים',
  };
  const opLabels: Record<AlertOperator, string> = {
    lt: 'מתחת ל',
    gt: 'מעל',
    lte: 'לא עולה על',
    gte: 'לא פחות מ',
  };
  return `${metricLabels[metric]}: ${value.toFixed(1)}% (${opLabels[operator]}${threshold}%)`;
}

export function evaluateRules(
  rules: AlertRule[],
  snapshot: Omit<KPISnapshot, 'alerts'>,
): Omit<
  Alert,
  | 'id'
  | 'tenantId'
  | 'ruleId'
  | 'acknowledged'
  | 'acknowledgedBy'
  | 'acknowledgedAt'
  | 'firedAt'
  | 'createdAt'
>[] {
  const metricValues: Record<KPIMetric, number | null> = {
    prep_completion_rate: snapshot.prepCompletionRate,
    checklist_completion_rate: snapshot.checklistCompletionRate,
    fc_percent: snapshot.fcPercent,
    active_recipes: snapshot.activeRecipes,
  };

  const fired = [];
  for (const rule of rules) {
    if (!rule.active) continue;
    const value = metricValues[rule.metric];
    if (value === null) continue;
    if (evalThreshold(value, rule.operator, rule.threshold)) {
      fired.push({
        metric: rule.metric,
        value,
        threshold: rule.threshold,
        severity: rule.severity,
        message: buildAlertMessage(rule.metric, value, rule.threshold, rule.operator),
        date: snapshot.date,
      });
    }
  }
  return fired;
}
